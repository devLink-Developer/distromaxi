from django.contrib import admin
from django.contrib.auth import get_user_model
from django.test import TestCase
from rest_framework.test import APIClient

from .admin import PlanAdmin
from .models import Plan


class PlanApiTests(TestCase):
    def setUp(self):
        self.client = APIClient()

    def test_plans_endpoint_is_public_and_ordered(self):
        Plan.objects.filter(name="IA").update(is_active=False)

        response = self.client.get("/api/plans")

        self.assertEqual(response.status_code, 200)
        self.assertEqual([plan["name"] for plan in response.data], ["START", "PRO"])
        self.assertTrue(set(response.data[0]).issuperset({"name", "price", "description", "mp_subscription_url", "mp_preapproval_plan_id"}))
        self.assertTrue(response.data[0]["mp_preapproval_plan_id"])
        self.assertTrue(response.data[1]["is_featured"])

    def test_plan_admin_exposes_editable_business_fields(self):
        model_admin = PlanAdmin(Plan, admin.site)

        self.assertIn("mp_subscription_url", model_admin.fields)
        self.assertIn("mp_preapproval_plan_id", model_admin.fields)
        self.assertIn("is_active", model_admin.fields)
        self.assertIn("sort_order", model_admin.fields)

    def test_role_admin_can_update_plan_subscription_url(self):
        user = get_user_model().objects.create_user(
            email="admin@distromax.local",
            password="Cambiar1234",
            full_name="Admin",
            role="ADMIN",
        )
        plan = Plan.objects.get(name="START")
        new_url = "https://www.mercadopago.com.ar/subscriptions/checkout?preapproval_plan_id=start-updated"

        self.client.force_authenticate(user=user)
        response = self.client.patch(
            f"/api/plans/{plan.id}/",
            {"mp_subscription_url": new_url, "mp_preapproval_plan_id": "start-updated"},
            format="json",
        )

        self.assertEqual(response.status_code, 200)
        plan.refresh_from_db()
        self.assertEqual(plan.mp_subscription_url, new_url)
        self.assertEqual(plan.mp_preapproval_plan_id, "start-updated")

    def test_non_admin_cannot_update_plan_subscription_url(self):
        user = get_user_model().objects.create_user(
            email="cliente@distromax.local",
            password="Cambiar1234",
            full_name="Cliente",
            role="COMMERCE",
        )
        plan = Plan.objects.get(name="START")
        original_url = plan.mp_subscription_url

        self.client.force_authenticate(user=user)
        response = self.client.patch(
            f"/api/plans/{plan.id}/",
            {"mp_subscription_url": "https://www.mercadopago.com.ar/blocked"},
            format="json",
        )

        self.assertEqual(response.status_code, 403)
        plan.refresh_from_db()
        self.assertEqual(plan.mp_subscription_url, original_url)
