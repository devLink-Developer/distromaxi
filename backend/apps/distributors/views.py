from rest_framework import permissions, viewsets
from rest_framework.exceptions import ValidationError

from .models import Distributor
from .serializers import DistributorSerializer


class DistributorViewSet(viewsets.ModelViewSet):
    serializer_class = DistributorSerializer

    def get_queryset(self):
        queryset = Distributor.objects.select_related("owner")
        user = self.request.user
        if user.role == "ADMIN" or user.is_superuser:
            return queryset
        if user.role == "DISTRIBUTOR":
            return queryset.filter(owner=user)
        return queryset.filter(active=True)

    def get_permissions(self):
        if self.action in {"create"}:
            return [permissions.IsAdminUser()]
        return [permissions.IsAuthenticated()]

    def perform_create(self, serializer):
        owner = serializer.validated_data.get("owner")
        if owner is None:
            raise ValidationError({"owner": "Debes seleccionar el usuario distribuidor que sera duenio de la cuenta."})
        serializer.save(owner=owner)

# Create your views here.
