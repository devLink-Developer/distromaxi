from django.conf import settings
from django.utils import timezone
from rest_framework import decorators, response, viewsets

from apps.distributors.utils import filter_by_distributor

from .models import NotificationEvent, PushSubscription
from .serializers import NotificationEventSerializer, PushSubscriptionSerializer
from .services import notify_user


class PushSubscriptionViewSet(viewsets.ModelViewSet):
    serializer_class = PushSubscriptionSerializer

    def get_queryset(self):
        return PushSubscription.objects.filter(user=self.request.user)

    def perform_create(self, serializer):
        serializer.save(user=self.request.user)

    @decorators.action(detail=False, methods=["get"], url_path="vapid-public-key")
    def vapid_public_key(self, request):
        return response.Response({"public_key": settings.WEBPUSH_VAPID_PUBLIC_KEY})


class NotificationEventViewSet(viewsets.ModelViewSet):
    serializer_class = NotificationEventSerializer

    def get_queryset(self):
        queryset = NotificationEvent.objects.select_related("user", "distributor")
        user = self.request.user
        if user.role == "COMMERCE" or user.role == "DRIVER":
            return queryset.filter(user=user)
        if user.role == "DISTRIBUTOR":
            return filter_by_distributor(queryset, user)
        return queryset

    @decorators.action(detail=True, methods=["patch"], url_path="read")
    def mark_read(self, request, pk=None):
        event = self.get_object()
        event.read_at = timezone.now()
        event.save(update_fields=["read_at"])
        return response.Response(self.get_serializer(event).data)

    @decorators.action(detail=False, methods=["post"], url_path="send-test")
    def send_test(self, request):
        event = notify_user(
            request.user,
            "DistroMaxi activo",
            "Las notificaciones push están configuradas para este dispositivo.",
            "SYSTEM",
        )
        return response.Response(self.get_serializer(event).data)

# Create your views here.
