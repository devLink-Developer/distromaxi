from rest_framework import permissions, status, viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import PermissionDenied
from rest_framework.response import Response

from apps.users.models import UserRole

from .models import FeedbackThread
from .serializers import FeedbackMessageSerializer, FeedbackReplySerializer, FeedbackThreadSerializer


class FeedbackThreadViewSet(viewsets.ModelViewSet):
    serializer_class = FeedbackThreadSerializer
    permission_classes = [permissions.IsAuthenticated]
    http_method_names = ["get", "post", "patch", "head", "options"]

    def get_queryset(self):
        queryset = FeedbackThread.objects.select_related("created_by").prefetch_related("messages__author")
        user = self.request.user
        if _is_admin(user):
            return queryset
        if user.role in {UserRole.COMMERCE, UserRole.DISTRIBUTOR}:
            return queryset.filter(created_by=user)
        return queryset.none()

    def perform_create(self, serializer):
        user = self.request.user
        if user.role not in {UserRole.COMMERCE, UserRole.DISTRIBUTOR} and not _is_admin(user):
            raise PermissionDenied("Solo compradores y distribuidoras pueden enviar opiniones.")
        serializer.save()

    @action(detail=True, methods=["post"])
    def reply(self, request, pk=None):
        thread = self.get_object()
        if not _is_admin(request.user) and thread.created_by_id != request.user.id:
            raise PermissionDenied("No podes responder este hilo.")
        serializer = FeedbackReplySerializer(data=request.data, context={"request": request, "thread": thread})
        serializer.is_valid(raise_exception=True)
        message = serializer.save()
        return Response(FeedbackMessageSerializer(message).data, status=status.HTTP_201_CREATED)


def _is_admin(user):
    return bool(user and user.is_authenticated and (user.role == UserRole.ADMIN or user.is_staff or user.is_superuser))
