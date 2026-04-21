from unittest.mock import patch

from django.contrib.auth import get_user_model
from django.test import TestCase
from rest_framework.test import APIClient

from apps.billing.models import Plan, Subscription
from apps.distributors.models import Distributor, DistributorOnboarding

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


class DistributorOnboardingFlowTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.plan = Plan.objects.get(name="PRO")
        self.plan.mp_preapproval_plan_id = "pro-plan-id"
        self.plan.mp_subscription_url = "https://www.mercadopago.com.ar/subscriptions/checkout?preapproval_plan_id=pro-plan-id"
        self.plan.save(update_fields=["mp_preapproval_plan_id", "mp_subscription_url"])

    def register_public_distributor(self, **overrides):
        payload = {
            "business_name": "Distribuidora Delta",
            "contact_name": "Claudia Perez",
            "email": "delta@test.local",
            "phone": "1111-2222",
            "tax_id": "30-12345678-9",
            "password": "Demo1234!",
        }
        payload.update(overrides)
        return self.client.post("/api/auth/register-distributor", payload, format="json")

    def login(self, email="delta@test.local", password="Demo1234!"):
        return self.client.post("/api/auth/login", {"email": email, "password": password}, format="json")

    def test_public_signup_creates_pending_distributor_user_and_onboarding(self):
        response = self.register_public_distributor()

        self.assertEqual(response.status_code, 201)
        user = User.objects.get(email="delta@test.local")
        onboarding = DistributorOnboarding.objects.get(user=user)
        self.assertEqual(user.role, "DISTRIBUTOR")
        self.assertEqual(onboarding.status, "ACCOUNT_CREATED")
        self.assertEqual(onboarding.tax_id, "30-12345678-9")
        self.assertEqual(response.data["user"]["distributor_access"]["state"], "ONBOARDING")
        self.assertEqual(response.data["onboarding"]["status"], "ACCOUNT_CREATED")

    def test_public_signup_rejects_duplicate_tax_id(self):
        self.register_public_distributor()

        response = self.register_public_distributor(email="otra@test.local")

        self.assertEqual(response.status_code, 400)
        self.assertIn("tax_id", response.data)

    def test_login_and_me_expose_pending_onboarding_access(self):
        self.register_public_distributor()

        login_response = self.login()
        self.assertEqual(login_response.status_code, 200)
        self.assertEqual(login_response.data["user"]["distributor_access"]["state"], "ONBOARDING")

        token = login_response.data["access"]
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {token}")
        onboarding_response = self.client.get("/api/distributor-onboarding")

        self.assertEqual(onboarding_response.status_code, 200)
        self.assertEqual(onboarding_response.data["access_state"], "ONBOARDING")
        self.assertEqual(onboarding_response.data["status"], "ACCOUNT_CREATED")

    def test_select_plan_marks_checkout_pending(self):
        self.register_public_distributor()
        token = self.login().data["access"]
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {token}")

        response = self.client.post("/api/distributor-onboarding/select-plan", {"plan_id": self.plan.id}, format="json")

        self.assertEqual(response.status_code, 200)
        onboarding = DistributorOnboarding.objects.get(email="delta@test.local")
        self.assertEqual(onboarding.plan, self.plan)
        self.assertEqual(onboarding.status, "CHECKOUT_PENDING")
        self.assertEqual(response.data["checkout_url"], self.plan.mp_subscription_url)

    @patch("apps.distributors.views.fetch_subscription_details")
    def test_authorized_webhook_activates_distributor_and_subscription(self, fetch_subscription_details):
        self.register_public_distributor()
        token = self.login().data["access"]
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {token}")
        self.client.post("/api/distributor-onboarding/select-plan", {"plan_id": self.plan.id}, format="json")
        self.client.credentials()

        fetch_subscription_details.return_value = {
            "id": "preapproval-123",
            "status": "authorized",
            "payer_email": "delta@test.local",
            "preapproval_plan_id": "pro-plan-id",
            "init_point": self.plan.mp_subscription_url,
            "date_created": "2026-04-20T10:00:00.000-03:00",
            "next_payment_date": "2026-05-20T10:00:00.000-03:00",
        }

        response = self.client.post("/api/billing/mercadopago/webhook", {"data": {"id": "preapproval-123"}}, format="json")

        self.assertEqual(response.status_code, 200)
        onboarding = DistributorOnboarding.objects.get(email="delta@test.local")
        distributor = Distributor.objects.get(owner__email="delta@test.local")
        subscription = Subscription.objects.get(distributor=distributor)
        self.assertEqual(onboarding.status, "ACTIVE")
        self.assertEqual(distributor.subscription_status, "ACTIVE")
        self.assertEqual(distributor.address, "")
        self.assertEqual(subscription.status, "ACTIVE")
        self.assertEqual(subscription.plan, self.plan)
        self.assertEqual(subscription.mercado_pago_subscription_id, "preapproval-123")

    @patch("apps.distributors.views.fetch_subscription_details")
    def test_webhook_with_mismatched_plan_goes_to_review_required(self, fetch_subscription_details):
        self.register_public_distributor()
        token = self.login().data["access"]
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {token}")
        self.client.post("/api/distributor-onboarding/select-plan", {"plan_id": self.plan.id}, format="json")
        self.client.credentials()

        fetch_subscription_details.return_value = {
            "id": "preapproval-456",
            "status": "authorized",
            "payer_email": "delta@test.local",
            "preapproval_plan_id": "another-plan-id",
        }

        response = self.client.post("/api/billing/mercadopago/webhook", {"data": {"id": "preapproval-456"}}, format="json")

        self.assertEqual(response.status_code, 202)
        onboarding = DistributorOnboarding.objects.get(email="delta@test.local")
        self.assertEqual(onboarding.status, "REVIEW_REQUIRED")
        self.assertIn("plan", onboarding.review_reason.lower())
        self.assertFalse(Distributor.objects.filter(owner__email="delta@test.local").exists())
