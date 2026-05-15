from unittest.mock import patch
from datetime import time
from decimal import Decimal

from django.contrib.auth import get_user_model
from django.test import TestCase
from rest_framework.test import APIClient

from apps.commerces.models import Commerce
from apps.billing.models import Plan, Subscription
from apps.distributors.models import Distributor, DistributorDeliverySlot, DistributorOnboarding

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

    def test_distributor_can_manage_delivery_slots(self):
        distributor = Distributor.objects.create(
            owner=self.distributor_user,
            business_name="Distribuidora Franjas",
            tax_id="30-00000000-2",
            contact_name="Ventas",
            email="franjas@test.local",
            phone="1111-3333",
            address="Ruta 1",
        )
        self.client.force_authenticate(self.distributor_user)

        create_response = self.client.post(
            "/api/delivery-slots/",
            {"name": "Maniana", "start_time": "08:00", "end_time": "12:00", "sort_order": 1, "active": True},
            format="json",
        )
        list_response = self.client.get("/api/delivery-slots/")
        patch_response = self.client.patch(f"/api/delivery-slots/{create_response.data['id']}/", {"active": False}, format="json")

        self.assertEqual(create_response.status_code, 201)
        self.assertEqual(create_response.data["distributor"], distributor.id)
        self.assertEqual(list_response.status_code, 200)
        self.assertEqual(len(list_response.data), 1)
        self.assertFalse(patch_response.data["active"])
        self.assertEqual(DistributorDeliverySlot.objects.get(pk=create_response.data["id"]).start_time, time(8, 0))

    def test_delivery_slot_rejects_invalid_window(self):
        Distributor.objects.create(
            owner=self.distributor_user,
            business_name="Distribuidora Franjas",
            tax_id="30-00000000-3",
            contact_name="Ventas",
            email="franjas2@test.local",
            phone="1111-4444",
            address="Ruta 2",
        )
        self.client.force_authenticate(self.distributor_user)

        response = self.client.post(
            "/api/delivery-slots/",
            {"name": "Invalida", "start_time": "12:00", "end_time": "08:00", "sort_order": 1, "active": True},
            format="json",
        )

        self.assertEqual(response.status_code, 400)
        self.assertIn("end_time", response.data)


class DistributorServiceAreaApiTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.distributor_user = User.objects.create_user(
            email="owner-scope@test.local",
            password="Demo1234!",
            full_name="Owner Alcance",
            role="DISTRIBUTOR",
        )
        self.commerce_user = User.objects.create_user(
            email="cliente-scope@test.local",
            password="Demo1234!",
            full_name="Cliente Alcance",
            role="COMMERCE",
        )
        self.distributor = Distributor.objects.create(
            owner=self.distributor_user,
            business_name="Distribuidora Alcance",
            tax_id="30-10101010-1",
            contact_name="Ventas",
            email="alcance@test.local",
            phone="1111-5555",
            address="Base 1",
            active=True,
            subscription_status="ACTIVE",
        )
        self.commerce = Commerce.objects.create(
            user=self.commerce_user,
            distributor=self.distributor,
            trade_name="Cliente Centro",
            contact_name="Compras",
            phone="2222-3333",
            postal_code="1414",
            address="Humboldt 1400",
            city="CABA",
            province="Buenos Aires",
            latitude=Decimal("-34.5841000"),
            longitude=Decimal("-58.4351000"),
        )

    def test_default_none_scope_is_hidden_from_clients(self):
        self.client.force_authenticate(self.commerce_user)

        response = self.client.get("/api/distributors/")

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data, [])

    def test_country_scope_is_visible_for_geolocated_argentina_client(self):
        self.distributor.service_area_mode = "COUNTRY"
        self.distributor.service_area_country = "AR"
        self.distributor.save(update_fields=["service_area_mode", "service_area_country", "updated_at"])
        self.client.force_authenticate(self.commerce_user)

        response = self.client.get("/api/distributors/")

        self.assertEqual(response.status_code, 200)
        self.assertEqual([row["id"] for row in response.data], [self.distributor.id])

    def test_polygon_scope_only_shows_distributor_when_point_is_inside(self):
        self.distributor.service_area_mode = "POLYGON"
        self.distributor.service_area_polygon = {
            "type": "Polygon",
            "coordinates": [
                [
                    [-58.50, -34.65],
                    [-58.30, -34.65],
                    [-58.30, -34.50],
                    [-58.50, -34.50],
                    [-58.50, -34.65],
                ]
            ],
        }
        self.distributor.save(update_fields=["service_area_mode", "service_area_polygon", "updated_at"])
        self.client.force_authenticate(self.commerce_user)

        inside_response = self.client.get("/api/distributors/")
        self.commerce.latitude = Decimal("-34.8000000")
        self.commerce.longitude = Decimal("-58.8000000")
        self.commerce.save(update_fields=["latitude", "longitude", "updated_at"])
        outside_response = self.client.get("/api/distributors/")

        self.assertEqual([row["id"] for row in inside_response.data], [self.distributor.id])
        self.assertEqual(outside_response.data, [])

    def test_distributor_can_update_own_service_area(self):
        self.client.force_authenticate(self.distributor_user)

        response = self.client.patch(
            f"/api/distributors/{self.distributor.id}/",
            {"service_area_mode": "COUNTRY"},
            format="json",
        )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["service_area_mode"], "COUNTRY")
        self.assertEqual(response.data["service_area_country"], "AR")
        self.assertIsNone(response.data["service_area_polygon"])


class DistributorOnboardingFlowTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.plan = Plan.objects.get(name="MaxiGestion")
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
            "accept_terms": True,
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
        self.assertIsNotNone(user.accepted_terms_at)
        self.assertTrue(user.accepted_terms_version)
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
