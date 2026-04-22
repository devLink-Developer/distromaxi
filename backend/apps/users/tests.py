from django.contrib.auth import get_user_model
from django.test import TestCase
from django.test.utils import override_settings
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

    @override_settings(OPENROUTESERVICE_API_KEY="")
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
        self.assertEqual(response.data["street"], "Humboldt")
        self.assertEqual(response.data["number"], "1400")
        self.assertEqual(response.data["city"], "CABA")
        self.assertEqual(response.data["latitude"], -34.58)

    @override_settings(OPENROUTESERVICE_API_KEY="ors-test-key")
    def test_address_reverse_geocode_endpoint_returns_street_and_number(self):
        from unittest.mock import patch

        payload = {
            "features": [
                {
                    "geometry": {"coordinates": [-58.4351, -34.5841]},
                    "properties": {
                        "label": "Humboldt 1400, Buenos Aires, Argentina",
                        "street": "Humboldt",
                        "housenumber": "1400",
                        "locality": "Palermo",
                        "region": "Ciudad Autonoma de Buenos Aires",
                    },
                }
            ]
        }
        with patch("apps.users.address_services._get_json", return_value=payload):
            response = self.client.get(
                "/api/address/reverse-geocode",
                {
                    "latitude": "-34.5841000",
                    "longitude": "-58.4351000",
                },
            )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["street"], "Humboldt")
        self.assertEqual(response.data["number"], "1400")
        self.assertEqual(response.data["latitude"], -34.5841)

    @override_settings(OPENROUTESERVICE_API_KEY="ors-test-key")
    def test_address_geocode_falls_back_when_ors_result_is_not_precise(self):
        from unittest.mock import patch

        ors_payload = {
            "features": [
                {
                    "geometry": {"coordinates": [-58.42187, -32.256896]},
                    "properties": {
                        "label": "Municipalidad de 1 de Mayo, ER, Argentina",
                        "street": "Presbitero Pascual Velzi",
                        "housenumber": "1940",
                        "region": "Entre Rios",
                    },
                }
            ]
        }
        georef_payload = {
            "direcciones": [
                {
                    "nomenclatura": "1 DE MAYO 2168, Parana, Entre Rios",
                    "provincia": {"nombre": "Entre Rios"},
                    "localidad_censal": {"nombre": "Parana"},
                    "ubicacion": {"lat": -31.73197, "lon": -60.5238},
                }
            ]
        }
        with patch("apps.users.address_services._get_json", side_effect=[ors_payload, georef_payload]):
            response = self.client.get(
                "/api/address/geocode",
                {
                    "street": "1 de Mayo",
                    "number": "2168",
                    "locality": "Parana",
                    "province": "Entre Rios",
                },
            )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["address"], "1 DE MAYO 2168, Parana, Entre Rios")
        self.assertEqual(response.data["street"], "1 de Mayo")
        self.assertEqual(response.data["number"], "2168")
        self.assertEqual(response.data["city"], "Parana")
        self.assertEqual(response.data["latitude"], -31.73197)

    @override_settings(OPENROUTESERVICE_API_KEY="ors-test-key")
    def test_address_geocode_falls_back_to_nominatim_when_exact_providers_fail(self):
        from unittest.mock import patch

        ors_payload = {
            "features": [
                {
                    "geometry": {"coordinates": [-60.5238, -31.73197]},
                    "properties": {
                        "label": "Parana, ER, Argentina",
                        "name": "Parana",
                        "region": "Entre Rios",
                    },
                }
            ]
        }
        georef_payload = {"direcciones": []}
        nominatim_payload = [
            {
                "lat": "-31.7381616",
                "lon": "-60.5477046",
                "name": "1 de Mayo",
                "display_name": "1 de Mayo, San Agustin Sud Oeste, Parana, Entre Rios, E3100, Argentina",
            }
        ]
        with patch("apps.users.address_services._get_json", side_effect=[ors_payload, georef_payload, nominatim_payload]):
            response = self.client.get(
                "/api/address/geocode",
                {
                    "street": "1 de Mayo",
                    "number": "2168",
                    "locality": "PARANA",
                    "province": "ENTRE RIOS",
                },
            )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["address"], "1 de Mayo 2168, PARANA, ENTRE RIOS")
        self.assertEqual(response.data["street"], "1 de Mayo")
        self.assertEqual(response.data["number"], "2168")
        self.assertEqual(response.data["city"], "PARANA")
        self.assertEqual(response.data["latitude"], -31.7381616)
