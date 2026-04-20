from rest_framework import viewsets

from apps.distributors.utils import filter_by_distributor, get_user_distributor

from .models import DriverProfile, Vehicle
from .serializers import DriverProfileSerializer, VehicleSerializer


class VehicleViewSet(viewsets.ModelViewSet):
    serializer_class = VehicleSerializer

    def get_queryset(self):
        queryset = Vehicle.objects.select_related("distributor")
        return filter_by_distributor(queryset, self.request.user)

    def perform_create(self, serializer):
        distributor = serializer.validated_data.get("distributor") or get_user_distributor(self.request.user)
        serializer.save(distributor=distributor)


class DriverProfileViewSet(viewsets.ModelViewSet):
    serializer_class = DriverProfileSerializer

    def get_queryset(self):
        queryset = DriverProfile.objects.select_related("user", "distributor", "assigned_vehicle")
        user = self.request.user
        if user.role == "DRIVER":
            return queryset.filter(user=user)
        return filter_by_distributor(queryset, user)

    def perform_create(self, serializer):
        distributor = serializer.validated_data.get("distributor") or get_user_distributor(self.request.user)
        serializer.save(distributor=distributor)

# Create your views here.
