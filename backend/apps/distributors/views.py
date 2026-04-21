from rest_framework import permissions, status, viewsets
from rest_framework.exceptions import ValidationError
from rest_framework.generics import CreateAPIView
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.billing.mercadopago import MercadoPagoApiError, fetch_subscription_details, webhook_subscription_id
from apps.billing.models import Plan, Subscription
from apps.distributors.services import (
    AUTHORIZED_MP_STATUSES,
    FAILED_MP_STATUSES,
    PENDING_MP_STATUSES,
    activate_onboarding_from_subscription,
    mark_onboarding_failed,
    mark_onboarding_pending,
    mark_onboarding_review,
    update_existing_subscription,
)
from apps.users.serializers import UserSerializer

from .models import Distributor, DistributorOnboarding, DistributorOnboardingStatus
from .serializers import (
    DistributorOnboardingStateSerializer,
    DistributorSerializer,
    DistributorSignupSerializer,
    SelectDistributorPlanSerializer,
)


class DistributorViewSet(viewsets.ModelViewSet):
    serializer_class = DistributorSerializer

    def get_queryset(self):
        queryset = Distributor.objects.select_related("owner")
        user = self.request.user
        if user.role == "ADMIN" or user.is_superuser:
            return queryset
        if user.role == "DISTRIBUTOR":
            return queryset.filter(owner=user)
        return queryset.filter(active=True)

    def get_permissions(self):
        if self.action in {"create", "destroy"}:
            return [permissions.IsAdminUser()]
        return [permissions.IsAuthenticated()]

    def perform_create(self, serializer):
        owner = serializer.validated_data.get("owner")
        if owner is None:
            raise ValidationError({"owner": "Debes seleccionar el usuario distribuidor que sera duenio de la cuenta."})
        serializer.save(owner=owner)


class DistributorSignupView(CreateAPIView):
    serializer_class = DistributorSignupSerializer
    permission_classes = [permissions.AllowAny]

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        user = serializer.save()
        onboarding_data = DistributorOnboardingStateSerializer.from_user(user).data
        return Response(
            {
                "user": UserSerializer(user, context=self.get_serializer_context()).data,
                "onboarding": onboarding_data,
            },
            status=status.HTTP_201_CREATED,
        )


class DistributorOnboardingStateView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        if request.user.role != "DISTRIBUTOR":
            raise ValidationError({"detail": "Solo las cuentas distribuidoras acceden a este flujo."})
        return Response(DistributorOnboardingStateSerializer.from_user(request.user).data)


class DistributorOnboardingPlanSelectionView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        if request.user.role != "DISTRIBUTOR":
            raise ValidationError({"detail": "Solo las cuentas distribuidoras pueden elegir planes."})
        serializer = SelectDistributorPlanSerializer(data=request.data, context={"request": request})
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(serializer.data)


class MercadoPagoSubscriptionWebhookView(APIView):
    permission_classes = [permissions.AllowAny]
    authentication_classes = []

    def post(self, request):
        payload = request.data if isinstance(request.data, dict) else {}
        subscription_id = webhook_subscription_id(payload, request.query_params)
        try:
            subscription_data = fetch_subscription_details(subscription_id)
        except MercadoPagoApiError as exc:
            return Response({"detail": str(exc)}, status=status.HTTP_202_ACCEPTED)

        mp_status = str(subscription_data.get("status") or "").strip().lower()
        payer_email = str(subscription_data.get("payer_email") or "").strip().lower()
        preapproval_plan_id = str(subscription_data.get("preapproval_plan_id") or "").strip()
        payment_link = str(subscription_data.get("init_point") or "")

        existing_subscription = Subscription.objects.select_related("distributor", "plan").filter(
            mercado_pago_subscription_id=subscription_id
        ).first()
        if existing_subscription:
            update_existing_subscription(existing_subscription, mp_status, subscription_id, payment_link)
            return Response({"status": "updated"})

        plan = Plan.objects.filter(mp_preapproval_plan_id=preapproval_plan_id).first() if preapproval_plan_id else None
        onboarding_candidates = DistributorOnboarding.objects.select_related("plan", "user").filter(email__iexact=payer_email)

        if onboarding_candidates.count() != 1:
            for onboarding in onboarding_candidates:
                mark_onboarding_review(
                    onboarding,
                    "No fue posible conciliar de forma univoca la suscripcion con la cuenta creada.",
                    mp_status=mp_status,
                    mp_subscription_id=subscription_id,
                )
            return Response({"status": "review_required"}, status=status.HTTP_202_ACCEPTED)

        onboarding = onboarding_candidates.first()
        if onboarding is None:
            return Response({"status": "ignored"}, status=status.HTTP_202_ACCEPTED)

        if onboarding.status == DistributorOnboardingStatus.ACTIVE and onboarding.user.owned_distributors.exists():
            distributor = onboarding.user.owned_distributors.first()
            subscription = getattr(distributor, "subscription", None)
            if subscription is not None:
                update_existing_subscription(subscription, mp_status, subscription_id, payment_link)
                return Response({"status": "updated"})

        if plan is None or onboarding.plan_id != plan.id:
            mark_onboarding_review(
                onboarding,
                "El plan confirmado por Mercado Pago no coincide con el plan elegido en DistroMaxi.",
                mp_status=mp_status,
                mp_subscription_id=subscription_id,
            )
            return Response({"status": "review_required"}, status=status.HTTP_202_ACCEPTED)

        if mp_status in AUTHORIZED_MP_STATUSES:
            activate_onboarding_from_subscription(onboarding, plan, subscription_data)
            return Response({"status": "activated"})
        if mp_status in PENDING_MP_STATUSES:
            mark_onboarding_pending(onboarding, mp_status=mp_status)
            return Response({"status": "pending"}, status=status.HTTP_202_ACCEPTED)
        if mp_status in FAILED_MP_STATUSES:
            mark_onboarding_failed(
                onboarding,
                "Mercado Pago informo que la suscripcion no pudo activarse.",
                mp_status=mp_status,
                mp_subscription_id=subscription_id,
            )
            return Response({"status": "failed"}, status=status.HTTP_202_ACCEPTED)

        mark_onboarding_review(
            onboarding,
            "Llegaron datos de suscripcion que requieren revision manual.",
            mp_status=mp_status,
            mp_subscription_id=subscription_id,
        )
        return Response({"status": "review_required"}, status=status.HTTP_202_ACCEPTED)

# Create your views here.
