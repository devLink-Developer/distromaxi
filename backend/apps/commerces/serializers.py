from rest_framework import serializers

from .models import Commerce


class CommerceSerializer(serializers.ModelSerializer):
    user_email = serializers.EmailField(source="user.email", read_only=True)
    distributor_name = serializers.CharField(source="distributor.business_name", read_only=True)

    class Meta:
        model = Commerce
        fields = [
            "id",
            "user",
            "user_email",
            "distributor",
            "distributor_name",
            "trade_name",
            "legal_name",
            "tax_id",
            "contact_name",
            "email",
            "phone",
            "address",
            "city",
            "province",
            "latitude",
            "longitude",
            "delivery_notes",
            "active",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["id", "created_at", "updated_at"]
        extra_kwargs = {"user": {"required": False}, "distributor": {"required": False}}
