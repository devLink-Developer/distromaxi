from django.contrib.auth import get_user_model
from django.test import TestCase
from rest_framework.test import APIClient

from apps.distributors.models import Distributor
from apps.fleet.models import DriverProfile

User = get_user_model()


class DriverProvisioningTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.admin = User.objects.create_superuser(
            email="admin@test.local",
            password="Demo1234!",
            full_name="Admin",
        )
        self.distributor_user = User.objects.create_user(
            email="dist@test.local",
            password="Demo1234!",
            full_name="Distribuidor",
            role="DISTRIBUTOR",
        )
        self.distributor = Distributor.objects.create(
            owner=self.distributor_user,
            business_name="Distribuidora Test",
            tax_id="30-12345678-9",
            contact_name="Ventas",
            email="dist@test.local",
            phone="1111-2222",
            address="Ruta 9 km 10",
            subscription_status="ACTIVE",
        )

    def test_distributor_can_create_driver_accounts(self):
        self.client.force_authenticate(self.distributor_user)
        response = self.client.post(
            "/api/drivers/",
            {
                "email": "driver@test.local",
                "name": "Chofer Uno",
                "phone": "1111-3333",
                "license_number": "LIC-001",
                "license_category": "B1",
            },
            format="json",
        )

        self.assertEqual(response.status_code, 201)
        driver = DriverProfile.objects.get(user__email="driver@test.local")
        self.assertEqual(driver.distributor, self.distributor)
        self.assertEqual(driver.user.role, "DRIVER")

    def test_admin_cannot_create_driver_accounts(self):
        self.client.force_authenticate(self.admin)
        response = self.client.post(
            "/api/drivers/",
            {
                "email": "driver-admin@test.local",
                "name": "Chofer Admin",
                "phone": "1111-3333",
                "license_number": "LIC-002",
                "license_category": "B1",
                "distributor": self.distributor.id,
            },
            format="json",
        )

        self.assertEqual(response.status_code, 403)
        self.assertFalse(DriverProfile.objects.filter(user__email="driver-admin@test.local").exists())
