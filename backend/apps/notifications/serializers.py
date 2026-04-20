from rest_framework import serializers

from .models import NotificationEvent, PushSubscription


class PushSubscriptionSerializer(serializers.ModelSerializer):
    class Meta:
        model = PushSubscription
        fields = ["id", "endpoint", "p256dh", "auth", "user_agent", "active", "created_at", "updated_at"]
        read_only_fields = ["id", "created_at", "updated_at"]


class NotificationEventSerializer(serializers.ModelSerializer):
    class Meta:
        model = NotificationEvent
        fields = [
            "id",
            "user",
            "distributor",
            "kind",
            "title",
            "body",
            "payload",
            "read_at",
            "delivery_status",
            "created_at",
        ]
        read_only_fields = ["id", "created_at", "delivery_status"]
