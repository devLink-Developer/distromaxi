from rest_framework import status, viewsets
from rest_framework.exceptions import PermissionDenied
from rest_framework.response import Response

from apps.distributors.utils import filter_by_distributor, get_user_distributor

from .models import DriverProfile, Vehicle
from .serializers import DriverProfileSerializer, VehicleSerializer


class VehicleViewSet(viewsets.ModelViewSet):
    serializer_class = VehicleSerializer

    def get_queryset(self):
        queryset = Vehicle.objects.select_related("distributor")
        return filter_by_distributor(queryset, self.request.user)

    def create(self, request, *args, **kwargs):
        data = request.data.copy()
        if not data.get("distributor"):
            distributor = get_user_distributor(request.user)
            if distributor is not None:
                data["distributor"] = distributor.id
        serializer = self.get_serializer(data=data)
        serializer.is_valid(raise_exception=True)
        self.perform_create(serializer)
        headers = self.get_success_headers(serializer.data)
        return Response(serializer.data, status=status.HTTP_201_CREATED, headers=headers)

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
        if self.request.user.role != "DISTRIBUTOR":
            raise PermissionDenied("Los choferes deben ser creados por la distribuidora.")
        distributor = serializer.validated_data.get("distributor") or get_user_distributor(self.request.user)
        serializer.save(distributor=distributor)

# Create your views here.
