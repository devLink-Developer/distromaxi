from django.contrib.auth import get_user_model
from django.db import transaction
from django.utils import timezone
from rest_framework import serializers

from apps.billing.serializers import PlanSerializer
from apps.billing.models import Plan
from apps.users.models import UserRole

from .models import Distributor, DistributorOnboarding, DistributorOnboardingStatus
from .services import onboarding_snapshot_for_user

User = get_user_model()


class DistributorSerializer(serializers.ModelSerializer):
    owner_email = serializers.EmailField(source="owner.email", read_only=True)
    can_operate = serializers.BooleanField(read_only=True)

    class Meta:
        model = Distributor
        fields = [
            "id",
            "owner",
            "owner_email",
            "business_name",
            "tax_id",
            "contact_name",
            "email",
            "phone",
            "address",
            "city",
            "province",
            "latitude",
            "longitude",
            "currency",
            "plan_name",
            "subscription_status",
            "mercado_pago_link",
            "active",
            "can_operate",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["id", "created_at", "updated_at", "can_operate"]
        extra_kwargs = {"owner": {"required": False}}

    def validate_owner(self, value):
        if value.role != UserRole.DISTRIBUTOR:
            raise serializers.ValidationError("Selecciona un usuario con rol DISTRIBUTOR.")
        return value

    def validate(self, attrs):
        attrs = super().validate(attrs)
        request = self.context.get("request")
        user = getattr(request, "user", None)
        if user and user.is_authenticated and user.role != UserRole.ADMIN and not user.is_superuser:
            forbidden = {
                "owner",
                "tax_id",
                "currency",
                "plan_name",
                "subscription_status",
                "mercado_pago_link",
                "active",
            }
            changed = forbidden.intersection(attrs.keys())
            if changed:
                raise serializers.ValidationError("Solo admin puede editar los datos comerciales o de suscripcion.")
        return attrs


class DistributorSignupSerializer(serializers.Serializer):
    email = serializers.EmailField()
    password = serializers.CharField(write_only=True, min_length=8)
    business_name = serializers.CharField(max_length=180)
    contact_name = serializers.CharField(max_length=180)
    phone = serializers.CharField(max_length=40)
    tax_id = serializers.CharField(max_length=40)

    def validate_email(self, value):
        if User.objects.filter(email__iexact=value).exists():
            raise serializers.ValidationError("Ya existe una cuenta con este email.")
        return value

    def validate_tax_id(self, value):
        normalized = value.strip()
        if Distributor.objects.filter(tax_id__iexact=normalized).exists() or DistributorOnboarding.objects.filter(tax_id__iexact=normalized).exists():
            raise serializers.ValidationError("Ya existe una cuenta distribuidora con este CUIT.")
        return normalized

    @transaction.atomic
    def create(self, validated_data):
        password = validated_data.pop("password")
        user = User.objects.create_user(
            email=validated_data["email"],
            password=password,
            full_name=validated_data["contact_name"],
            phone=validated_data["phone"],
            role=UserRole.DISTRIBUTOR,
        )
        DistributorOnboarding.objects.create(
            user=user,
            email=user.email,
            business_name=validated_data["business_name"],
            tax_id=validated_data["tax_id"],
            contact_name=validated_data["contact_name"],
            phone=validated_data["phone"],
            status=DistributorOnboardingStatus.ACCOUNT_CREATED,
        )
        return user


class DistributorOnboardingStateSerializer(serializers.Serializer):
    access_state = serializers.CharField()
    status = serializers.CharField(allow_null=True)
    onboarding_id = serializers.IntegerField(allow_null=True)
    distributor_id = serializers.IntegerField(allow_null=True)
    business_name = serializers.CharField()
    tax_id = serializers.CharField(allow_blank=True)
    contact_name = serializers.CharField()
    email = serializers.EmailField()
    phone = serializers.CharField()
    selected_plan = PlanSerializer(allow_null=True)
    checkout_url = serializers.CharField(allow_blank=True)
    review_reason = serializers.CharField(allow_blank=True)
    failure_reason = serializers.CharField(allow_blank=True)
    mercado_pago_status = serializers.CharField(allow_blank=True)
    checkout_started_at = serializers.DateTimeField(allow_null=True)
    activated_at = serializers.DateTimeField(allow_null=True)
    created_at = serializers.DateTimeField(allow_null=True)
    updated_at = serializers.DateTimeField(allow_null=True)

    @classmethod
    def from_user(cls, user):
        snapshot = onboarding_snapshot_for_user(user)
        return cls(snapshot)


class SelectDistributorPlanSerializer(serializers.Serializer):
    plan_id = serializers.IntegerField(write_only=True)
    checkout_url = serializers.CharField(read_only=True)
    onboarding = DistributorOnboardingStateSerializer(read_only=True)

    def validate_plan_id(self, value):
        try:
            plan = Plan.objects.get(pk=value, is_active=True)
        except Plan.DoesNotExist as exc:
            raise serializers.ValidationError("Selecciona un plan publicado.") from exc
        if not plan.mp_subscription_url:
            raise serializers.ValidationError("Este plan todavia no tiene link de suscripcion.")
        if not plan.mp_preapproval_plan_id:
            raise serializers.ValidationError("Este plan no tiene configurado el identificador de Mercado Pago.")
        self.context["plan"] = plan
        return value

    def validate(self, attrs):
        attrs = super().validate(attrs)
        try:
            onboarding = self.context["request"].user.distributor_onboarding
        except DistributorOnboarding.DoesNotExist:
            onboarding = None
        if onboarding is None:
            raise serializers.ValidationError("No encontramos un onboarding pendiente para esta cuenta.")
        if onboarding.status == DistributorOnboardingStatus.ACTIVE:
            raise serializers.ValidationError("La cuenta ya se encuentra activa.")
        self.context["onboarding"] = onboarding
        return attrs

    def create(self, validated_data):
        onboarding = self.context["onboarding"]
        plan = self.context["plan"]
        onboarding.plan = plan
        onboarding.status = DistributorOnboardingStatus.CHECKOUT_PENDING
        onboarding.review_reason = ""
        onboarding.failure_reason = ""
        onboarding.checkout_started_at = timezone.now()
        onboarding.save(
            update_fields=[
                "plan",
                "status",
                "review_reason",
                "failure_reason",
                "checkout_started_at",
                "updated_at",
            ]
        )
        return {
            "checkout_url": plan.mp_subscription_url,
            "onboarding": onboarding_snapshot_for_user(onboarding.user),
        }
