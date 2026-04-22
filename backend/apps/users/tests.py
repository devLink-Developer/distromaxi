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

    def test_postal_code_lookup_endpoint_returns_city_and_localities(self):
        from unittest.mock import patch

        payload = {
            "country": "Argentina",
            "places": [
                {"place name": "FLORIDA", "state": "BUENOS AIRES"},
                {"place name": "MUNOZ", "state": "BUENOS AIRES"},
            ],
        }
        with patch("apps.users.address_services._get_json", return_value=payload):
            response = self.client.get("/api/address/postal-code", {"postal_code": "1602"})

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["postal_code"], "1602")
        self.assertEqual(response.data["province"], "BUENOS AIRES")
        self.assertEqual(response.data["localities"], ["FLORIDA", "MUNOZ"])

    def test_address_geocode_endpoint_returns_coordinates(self):
        from unittest.mock import patch

        payload = {
            "direcciones": [
                {
                    "nomenclatura": "HUMBOLDT 1400, Ciudad Autonoma de Buenos Aires",
                    "provincia": {"nombre": "Ciudad Autonoma de Buenos Aires"},
                    "localidad_censal": {"nombre": "CABA"},
                    "ubicacion": {"lat": -34.58, "lon": -58.43},
                }
            ]
        }
        with patch("apps.users.address_services._get_json", return_value=payload):
            response = self.client.get(
                "/api/address/geocode",
                {
                    "street": "Humboldt",
                    "number": "1400",
                    "locality": "CABA",
                    "province": "CABA",
                },
            )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["address"], "HUMBOLDT 1400, Ciudad Autonoma de Buenos Aires")
        self.assertEqual(response.data["city"], "CABA")
        self.assertEqual(response.data["latitude"], -34.58)
