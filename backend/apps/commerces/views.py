from rest_framework import viewsets

from apps.distributors.utils import filter_by_distributor, get_user_distributor

from .models import Commerce
from .serializers import CommerceSerializer


class CommerceViewSet(viewsets.ModelViewSet):
    serializer_class = CommerceSerializer

    def get_queryset(self):
        queryset = Commerce.objects.select_related("user", "distributor")
        user = self.request.user
        if user.role == "COMMERCE":
            return queryset.filter(user=user)
        return filter_by_distributor(queryset, user)

    def perform_create(self, serializer):
        distributor = serializer.validated_data.get("distributor") or get_user_distributor(self.request.user)
        serializer.save(distributor=distributor)

# Create your views here.
