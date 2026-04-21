from rest_framework import serializers

from .models import Plan, Subscription


class PlanSerializer(serializers.ModelSerializer):
    class Meta:
        model = Plan
        fields = [
            "id",
            "name",
            "price",
            "description",
            "currency",
            "mp_subscription_url",
            "mp_preapproval_plan_id",
            "is_active",
            "sort_order",
            "is_featured",
            "max_products",
            "max_drivers",
        ]


class SubscriptionSerializer(serializers.ModelSerializer):
    distributor_name = serializers.CharField(source="distributor.business_name", read_only=True)
    plan_name = serializers.CharField(source="plan.name", read_only=True)

    class Meta:
        model = Subscription
        fields = [
            "id",
            "distributor",
            "distributor_name",
            "plan",
            "plan_name",
            "status",
            "mercado_pago_link",
            "mercado_pago_subscription_id",
            "starts_at",
            "expires_at",
            "notes",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["id", "created_at", "updated_at"]
