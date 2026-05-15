from django.db import transaction
from django.utils import timezone
from rest_framework import serializers

from apps.users.models import UserRole

from .models import FeedbackMessage, FeedbackThread


class FeedbackMessageSerializer(serializers.ModelSerializer):
    author_name = serializers.CharField(source="author.full_name", read_only=True)
    author_role = serializers.CharField(source="author.role", read_only=True)

    class Meta:
        model = FeedbackMessage
        fields = ["id", "author", "author_name", "author_role", "body", "is_staff_reply", "created_at"]
        read_only_fields = fields


class FeedbackThreadSerializer(serializers.ModelSerializer):
    messages = FeedbackMessageSerializer(many=True, read_only=True)
    created_by_name = serializers.CharField(source="created_by.full_name", read_only=True)
    created_by_email = serializers.EmailField(source="created_by.email", read_only=True)
    created_by_role = serializers.CharField(source="created_by.role", read_only=True)
    initial_message = serializers.CharField(write_only=True, required=False, allow_blank=False)

    class Meta:
        model = FeedbackThread
        fields = [
            "id",
            "created_by",
            "created_by_name",
            "created_by_email",
            "created_by_role",
            "subject",
            "category",
            "status",
            "last_message_at",
            "created_at",
            "updated_at",
            "messages",
            "initial_message",
        ]
        read_only_fields = [
            "id",
            "created_by",
            "created_by_name",
            "created_by_email",
            "created_by_role",
            "last_message_at",
            "created_at",
            "updated_at",
            "messages",
        ]

    def validate(self, attrs):
        attrs = super().validate(attrs)
        request = self.context.get("request")
        user = getattr(request, "user", None)
        if self.instance is None and not attrs.get("initial_message"):
            raise serializers.ValidationError({"initial_message": "Contanos tu opinion para abrir el hilo."})
        if self.instance is not None and "status" in attrs and not _is_admin(user):
            raise serializers.ValidationError({"status": "Solo administradores pueden cambiar el estado del hilo."})
        return attrs

    @transaction.atomic
    def create(self, validated_data):
        initial_message = validated_data.pop("initial_message")
        user = self.context["request"].user
        if user.role not in {UserRole.COMMERCE, UserRole.DISTRIBUTOR} and not _is_admin(user):
            raise serializers.ValidationError("Solo compradores y distribuidoras pueden enviar opiniones desde la app.")
        now = timezone.now()
        thread = FeedbackThread.objects.create(
            created_by=user,
            last_message_at=now,
            **validated_data,
        )
        FeedbackMessage.objects.create(
            thread=thread,
            author=user,
            body=initial_message,
            is_staff_reply=_is_admin(user),
        )
        return thread


class FeedbackReplySerializer(serializers.Serializer):
    body = serializers.CharField()

    @transaction.atomic
    def save(self, **kwargs):
        thread = self.context["thread"]
        user = self.context["request"].user
        is_staff_reply = _is_admin(user)
        message = FeedbackMessage.objects.create(
            thread=thread,
            author=user,
            body=self.validated_data["body"],
            is_staff_reply=is_staff_reply,
        )
        thread.last_message_at = message.created_at
        thread.status = FeedbackThread.Status.ANSWERED if is_staff_reply else FeedbackThread.Status.OPEN
        thread.save(update_fields=["last_message_at", "status", "updated_at"])
        return message


def _is_admin(user):
    return bool(user and user.is_authenticated and (user.role == UserRole.ADMIN or user.is_staff or user.is_superuser))
