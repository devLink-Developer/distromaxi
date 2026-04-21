from django.contrib.auth import get_user_model
from django.test import TestCase
from rest_framework.test import APIClient

from apps.commerces.models import Commerce

User = get_user_model()


class PublicRegisterTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.admin = User.objects.create_superuser(
            email="admin@test.local",
            password="Demo1234!",
            full_name="Admin",
        )

    def test_public_register_creates_customer_with_commerce_profile(self):
        response = self.client.post(
            "/api/auth/register",
            {
                "full_name": "Ana Perez",
                "trade_name": "Almacen Ana",
                "email": "ana@test.local",
                "phone": "1111-2222",
                "password": "Demo1234!",
            },
            format="json",
        )

        self.assertEqual(response.status_code, 201)
        user = User.objects.get(email="ana@test.local")
        commerce = Commerce.objects.get(user=user)
        self.assertEqual(user.role, "COMMERCE")
        self.assertEqual(commerce.trade_name, "Almacen Ana")
        self.assertEqual(commerce.contact_name, "Ana Perez")
        self.assertEqual(commerce.address, "")

    def test_public_register_rejects_non_customer_roles(self):
        response = self.client.post(
            "/api/auth/register",
            {
                "full_name": "Distribuidora Publica",
                "trade_name": "Distribuidora Publica",
                "email": "dist-publica@test.local",
                "phone": "1111-2222",
                "password": "Demo1234!",
                "role": "DISTRIBUTOR",
            },
            format="json",
        )

        self.assertEqual(response.status_code, 400)
        self.assertIn("role", response.data)
        self.assertFalse(User.objects.filter(email="dist-publica@test.local").exists())

    def test_admin_users_endpoint_rejects_driver_creation(self):
        self.client.force_authenticate(self.admin)
        response = self.client.post(
            "/api/users/",
            {
                "email": "driver@test.local",
                "full_name": "Chofer Admin",
                "phone": "1111-2222",
                "role": "DRIVER",
            },
            format="json",
        )

        self.assertEqual(response.status_code, 400)
        self.assertIn("role", response.data)
