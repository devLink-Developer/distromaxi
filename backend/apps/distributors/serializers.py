from rest_framework import serializers

from apps.users.models import UserRole

from .models import Distributor


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
