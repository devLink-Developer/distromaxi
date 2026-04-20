from django.contrib.auth import get_user_model
from rest_framework import permissions, viewsets
from rest_framework.generics import CreateAPIView, RetrieveAPIView
from rest_framework_simplejwt.views import TokenObtainPairView

from .serializers import CustomTokenObtainPairSerializer, RegisterSerializer, UserSerializer

User = get_user_model()


class CustomTokenObtainPairView(TokenObtainPairView):
    serializer_class = CustomTokenObtainPairSerializer


class RegisterView(CreateAPIView):
    serializer_class = RegisterSerializer
    permission_classes = [permissions.AllowAny]


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
