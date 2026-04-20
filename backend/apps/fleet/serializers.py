from django.contrib.auth import get_user_model
from rest_framework import serializers

from .models import DriverProfile, Vehicle

User = get_user_model()


class VehicleSerializer(serializers.ModelSerializer):
    distributor_name = serializers.CharField(source="distributor.business_name", read_only=True)

    class Meta:
        model = Vehicle
        fields = [
            "id",
            "distributor",
            "distributor_name",
            "plate",
            "vehicle_type",
            "brand",
            "model",
            "year",
            "capacity_kg",
            "status",
            "insurance_expires_at",
            "inspection_expires_at",
            "active",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["id", "created_at", "updated_at"]
        extra_kwargs = {"distributor": {"required": False}}


class DriverProfileSerializer(serializers.ModelSerializer):
    user_email = serializers.EmailField(source="user.email", read_only=True)
    full_name = serializers.CharField(source="user.full_name", read_only=True)
    distributor_name = serializers.CharField(source="distributor.business_name", read_only=True)
    assigned_vehicle_plate = serializers.CharField(source="assigned_vehicle.plate", read_only=True)
    email = serializers.EmailField(write_only=True, required=False)
    name = serializers.CharField(write_only=True, required=False)

    class Meta:
        model = DriverProfile
        fields = [
            "id",
            "user",
            "user_email",
            "full_name",
            "email",
            "name",
            "distributor",
            "distributor_name",
            "license_number",
            "license_category",
            "license_expires_at",
            "phone",
            "emergency_contact",
            "assigned_vehicle",
            "assigned_vehicle_plate",
            "available",
            "active",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["id", "created_at", "updated_at"]
        extra_kwargs = {"user": {"required": False}, "distributor": {"required": False}}

    def create(self, validated_data):
        email = validated_data.pop("email", None)
        name = validated_data.pop("name", None)
        if not validated_data.get("user"):
            if not email:
                raise serializers.ValidationError({"email": "Email requerido para crear chofer."})
            user, created = User.objects.get_or_create(
                email=email,
                defaults={"full_name": name or email, "role": "DRIVER", "phone": validated_data.get("phone", "")},
            )
            if created:
                user.set_password("Cambiar1234")
                user.save(update_fields=["password"])
            validated_data["user"] = user
        return super().create(validated_data)
