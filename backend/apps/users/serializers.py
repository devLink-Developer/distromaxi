from django.contrib.auth import get_user_model
from django.db import transaction
from rest_framework import serializers
from rest_framework_simplejwt.serializers import TokenObtainPairSerializer

from apps.commerces.models import Commerce
from apps.distributors.services import distributor_access_for_user

from .models import UserRole

User = get_user_model()


class UserSerializer(serializers.ModelSerializer):
    password = serializers.CharField(write_only=True, required=False, min_length=8)
    distributor_access = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = ["id", "email", "password", "full_name", "phone", "role", "is_active", "created_at", "distributor_access"]
        read_only_fields = ["id", "created_at"]

    def get_distributor_access(self, obj):
        return distributor_access_for_user(obj).as_dict()

    def validate_role(self, value):
        if value == UserRole.DRIVER and (self.instance is None or self.instance.role != UserRole.DRIVER):
            raise serializers.ValidationError("Los choferes deben crearse desde la distribuidora.")
        return value

    def create(self, validated_data):
        password = validated_data.pop("password", "Cambiar1234")
        return User.objects.create_user(password=password, **validated_data)

    def update(self, instance, validated_data):
        password = validated_data.pop("password", None)
        for key, value in validated_data.items():
            setattr(instance, key, value)
        if password:
            instance.set_password(password)
        instance.save()
        return instance


class RegisterSerializer(serializers.ModelSerializer):
    password = serializers.CharField(write_only=True, min_length=8)
    role = serializers.ChoiceField(
        choices=((UserRole.COMMERCE, "Cliente"),),
        required=False,
        default=UserRole.COMMERCE,
    )
    trade_name = serializers.CharField(write_only=True)
    address = serializers.CharField(write_only=True)
    city = serializers.CharField(write_only=True, required=False, allow_blank=True)
    province = serializers.CharField(write_only=True, required=False, allow_blank=True)

    class Meta:
        model = User
        fields = ["id", "email", "password", "full_name", "phone", "role", "trade_name", "address", "city", "province"]
        read_only_fields = ["id"]

    @transaction.atomic
    def create(self, validated_data):
        password = validated_data.pop("password")
        validated_data.pop("role", None)
        trade_name = validated_data.pop("trade_name")
        address = validated_data.pop("address")
        city = validated_data.pop("city", "")
        province = validated_data.pop("province", "")
        user = User.objects.create_user(password=password, role=UserRole.COMMERCE, **validated_data)
        Commerce.objects.create(
            user=user,
            trade_name=trade_name,
            contact_name=user.full_name,
            email=user.email,
            phone=user.phone,
            address=address,
            city=city,
            province=province,
        )
        return user


class CustomTokenObtainPairSerializer(TokenObtainPairSerializer):
    username_field = User.EMAIL_FIELD

    def validate(self, attrs):
        data = super().validate(attrs)
        data["user"] = UserSerializer(self.user).data
        return data
