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
            "postal_code",
            "address",
            "city",
            "province",
            "latitude",
            "longitude",
            "default_window_start",
            "default_window_end",
            "delivery_notes",
            "active",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["id", "created_at", "updated_at"]
        extra_kwargs = {"user": {"required": False}, "distributor": {"required": False}}

    def validate(self, attrs):
        attrs = super().validate(attrs)
        start = attrs.get("default_window_start", getattr(self.instance, "default_window_start", None))
        end = attrs.get("default_window_end", getattr(self.instance, "default_window_end", None))
        if start and end and start > end:
            raise serializers.ValidationError("La ventana horaria del comercio es invalida.")
        address = attrs.get("address", getattr(self.instance, "address", ""))
        postal_code = attrs.get("postal_code", getattr(self.instance, "postal_code", ""))
        city = attrs.get("city", getattr(self.instance, "city", ""))
        province = attrs.get("province", getattr(self.instance, "province", ""))
        latitude = attrs.get("latitude", getattr(self.instance, "latitude", None))
        longitude = attrs.get("longitude", getattr(self.instance, "longitude", None))
        if address and (not postal_code or not city or not province):
            raise serializers.ValidationError("Completa codigo postal, ciudad y provincia para guardar la direccion.")
        if address and (latitude is None or longitude is None):
            raise serializers.ValidationError("Debes geolocalizar la direccion antes de guardarla.")
        return attrs
