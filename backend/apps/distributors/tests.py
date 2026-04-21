from django.contrib.auth import get_user_model
from django.test import TestCase
from rest_framework.test import APIClient

from apps.distributors.models import Distributor

User = get_user_model()


class DistributorAdminFlowTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.admin = User.objects.create_superuser(
            email="admin@test.local",
            password="Demo1234!",
            full_name="Admin",
        )
        self.distributor_user = User.objects.create_user(
            email="owner@test.local",
            password="Demo1234!",
            full_name="Owner Distribuidor",
            role="DISTRIBUTOR",
        )

    def test_admin_creates_distributor_with_distributor_owner(self):
        self.client.force_authenticate(self.admin)
        response = self.client.post(
            "/api/distributors/",
            {
                "owner": self.distributor_user.id,
                "business_name": "Distribuidora Norte",
                "tax_id": "30-12345678-9",
                "contact_name": "Ventas",
                "email": "ventas@norte.local",
                "phone": "1111-2222",
                "address": "Ruta 9 km 10",
            },
            format="json",
        )

        self.assertEqual(response.status_code, 201)
        distributor = Distributor.objects.get(business_name="Distribuidora Norte")
        self.assertEqual(distributor.owner, self.distributor_user)

    def test_non_admin_cannot_create_distributor(self):
        self.client.force_authenticate(self.distributor_user)
        response = self.client.post(
            "/api/distributors/",
            {
                "business_name": "Distribuidora Sur",
                "tax_id": "30-00000000-1",
                "contact_name": "Ventas",
                "email": "ventas@sur.local",
                "phone": "1111-2222",
                "address": "Ruta 3 km 20",
            },
            format="json",
        )

        self.assertEqual(response.status_code, 403)
