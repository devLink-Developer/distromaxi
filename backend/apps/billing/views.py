from rest_framework import permissions, viewsets

from apps.distributors.utils import filter_by_distributor

from .models import Plan, Subscription
from .serializers import PlanSerializer, SubscriptionSerializer


class IsAppAdmin(permissions.BasePermission):
    def has_permission(self, request, view):
        user = request.user
        return bool(
            user
            and user.is_authenticated
            and (user.role == "ADMIN" or user.is_staff or user.is_superuser)
        )


class PlanViewSet(viewsets.ModelViewSet):
    serializer_class = PlanSerializer
    http_method_names = ["get", "post", "patch", "put", "delete", "head", "options"]

    def get_permissions(self):
        if self.action in {"list", "retrieve"}:
            return [permissions.AllowAny()]
        return [IsAppAdmin()]

    def get_queryset(self):
        queryset = Plan.objects.all().order_by("sort_order", "price")
        user = self.request.user
        if not getattr(user, "is_staff", False):
            queryset = queryset.filter(is_active=True)
        return queryset


class SubscriptionViewSet(viewsets.ModelViewSet):
    serializer_class = SubscriptionSerializer

    def get_permissions(self):
        if self.action in {"create", "update", "partial_update", "destroy"}:
            return [IsAppAdmin()]
        return [permissions.IsAuthenticated()]

    def get_queryset(self):
        queryset = Subscription.objects.select_related("distributor", "plan")
        return filter_by_distributor(queryset, self.request.user)

# Create your views here.
