from django.contrib.auth import get_user_model
from rest_framework import permissions, status, viewsets
from rest_framework.generics import CreateAPIView, RetrieveAPIView
from rest_framework.response import Response
from rest_framework_simplejwt.views import TokenObtainPairView
from rest_framework.views import APIView

from .address_services import AddressServiceError, geocode_address, lookup_postal_code, reverse_geocode
from .serializers import (
    AddressGeocodeSerializer,
    AddressReverseGeocodeSerializer,
    CustomTokenObtainPairSerializer,
    PostalCodeLookupSerializer,
    RegisterSerializer,
    UserSerializer,
)

User = get_user_model()


class CustomTokenObtainPairView(TokenObtainPairView):
    serializer_class = CustomTokenObtainPairSerializer


class RegisterView(CreateAPIView):
    serializer_class = RegisterSerializer
    permission_classes = [permissions.AllowAny]


class PostalCodeLookupView(APIView):
    permission_classes = [permissions.AllowAny]

    def get(self, request):
        serializer = PostalCodeLookupSerializer(data=request.query_params)
        serializer.is_valid(raise_exception=True)
        try:
            payload = lookup_postal_code(serializer.validated_data["postal_code"])
        except AddressServiceError as exc:
            return Response({"detail": str(exc)}, status=status.HTTP_400_BAD_REQUEST)
        return Response(payload)


class AddressGeocodeView(APIView):
    permission_classes = [permissions.AllowAny]

    def get(self, request):
        serializer = AddressGeocodeSerializer(data=request.query_params)
        serializer.is_valid(raise_exception=True)
        try:
            payload = geocode_address(**serializer.validated_data)
        except AddressServiceError as exc:
            return Response({"detail": str(exc)}, status=status.HTTP_400_BAD_REQUEST)
        return Response(payload)


class AddressReverseGeocodeView(APIView):
    permission_classes = [permissions.AllowAny]

    def get(self, request):
        serializer = AddressReverseGeocodeSerializer(data=request.query_params)
        serializer.is_valid(raise_exception=True)
        try:
            payload = reverse_geocode(**serializer.validated_data)
        except AddressServiceError as exc:
            return Response({"detail": str(exc)}, status=status.HTTP_400_BAD_REQUEST)
        return Response(payload)


class MeView(RetrieveAPIView):
    serializer_class = UserSerializer

    def get_object(self):
        return self.request.user


class UserViewSet(viewsets.ModelViewSet):
    serializer_class = UserSerializer

    def get_queryset(self):
        if self.request.user.role == "ADMIN" or self.request.user.is_superuser:
            return User.objects.all().order_by("email")
        return User.objects.filter(pk=self.request.user.pk)

    def get_permissions(self):
        if self.action in {"create"}:
            return [permissions.IsAdminUser()]
        return [permissions.IsAuthenticated()]

# Create your views here.
