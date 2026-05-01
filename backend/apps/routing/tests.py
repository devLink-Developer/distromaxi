from datetime import date, timedelta
from decimal import Decimal
from unittest.mock import patch

from django.contrib.auth import get_user_model
from django.test import TestCase, override_settings
from rest_framework.test import APIClient

from apps.billing.models import Plan, Subscription
from apps.commerces.models import Commerce
from apps.distributors.models import Distributor
from apps.fleet.models import DriverProfile, Vehicle
from apps.inventory.services import adjust_stock, ensure_default_warehouse
from apps.orders.models import Order
from apps.products.models import Product
from apps.routing.models import RoutePlan, RoutePlanStatus

User = get_user_model()


class RoutingFlowTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.distributor_user = User.objects.create_user(
            email="pro@test.local",
            password="Demo1234!",
            full_name="Distribuidora Pro",
            role="DISTRIBUTOR",
        )
        self.driver_user = User.objects.create_user(
            email="driver@test.local",
            password="Demo1234!",
            full_name="Chofer Test",
            role="DRIVER",
        )
        self.distributor = Distributor.objects.create(
            owner=self.distributor_user,
            business_name="Distribuidora Pro",
            tax_id="30-123",
            contact_name="Ventas",
            email="pro@test.local",
            phone="111",
            address="Base",
            city="CABA",
            province="CABA",
            latitude=Decimal("-34.6037220"),
            longitude=Decimal("-58.3815920"),
            plan_name="PRO",
            subscription_status="ACTIVE",
            active=True,
        )
        plan, _ = Plan.objects.update_or_create(
            name="PRO",
            defaults={
                "price": Decimal("1.00"),
                "description": "Pro",
                "currency": "ARS",
                "is_active": True,
                "sort_order": 1,
            },
        )
        Subscription.objects.create(
            distributor=self.distributor,
            plan=plan,
            status="ACTIVE",
            starts_at=date.today(),
            expires_at=date.today() + timedelta(days=30),
        )
        self.commerce = Commerce.objects.create(
            distributor=self.distributor,
            trade_name="Comercio 1",
            contact_name="Compras",
            phone="222",
            address="Cliente 1",
            latitude=Decimal("-34.5841000"),
            longitude=Decimal("-58.4351000"),
        )
        self.product = Product.objects.create(
            distributor=self.distributor,
            sku="SKU-1",
            name="Agua",
            category="Bebidas",
            unit="bulto",
            weight=Decimal("10.000"),
            weight_unit="kg",
            length=Decimal("100.000"),
            width=Decimal("100.000"),
            height=Decimal("100.000"),
            dimension_unit="cm",
            price=Decimal("100.00"),
        )
        warehouse = ensure_default_warehouse(self.distributor)
        adjust_stock(self.product, Decimal("20.000"), note="test", warehouse=warehouse)
        self.vehicle = Vehicle.objects.create(
            distributor=self.distributor,
            plate="AB123CD",
            vehicle_type="Utilitario",
            capacity_kg=Decimal("500.00"),
            capacity_m3=Decimal("5.000"),
            insurance_expires_at=date.today() + timedelta(days=30),
            inspection_expires_at=date.today() + timedelta(days=30),
        )
        self.driver = DriverProfile.objects.create(
            user=self.driver_user,
            distributor=self.distributor,
            license_number="A1",
            license_category="B1",
            phone="333",
            assigned_vehicle=self.vehicle,
        )
        self.order = Order.objects.create(
            commerce=self.commerce,
            distributor=self.distributor,
            total=Decimal("100.00"),
            status="ACCEPTED",
            dispatch_date=date.today() + timedelta(days=1),
            delivery_address="Cliente 1",
            delivery_latitude=self.commerce.latitude,
            delivery_longitude=self.commerce.longitude,
        )
        self.order.items.create(
            product=self.product,
            product_name=self.product.name,
            sku=self.product.sku,
            quantity=Decimal("1.000"),
            price=self.product.price,
            subtotal=self.product.price,
            weight_kg=Decimal("10.000"),
            volume_m3=Decimal("1.000000"),
        )

    @override_settings(ORS_API_KEY="ors-test-key", OPENROUTESERVICE_API_KEY="ors-test-key")
    @patch("apps.routing.engine.ors_build_directions")
    @patch("apps.routing.engine.ors_build_matrix")
    def test_generate_confirm_dispatch_and_complete_route(self, build_matrix, build_directions):
        build_matrix.return_value = {
            "durations_min": [[0, 20], [20, 0]],
            "distances_km": [[0, 12], [12, 0]],
        }
        build_directions.return_value = {
            "distance_km": 12,
            "duration_min": 20,
            "geometry": {"type": "LineString", "coordinates": [[-58.381592, -34.603722], [-58.4351, -34.5841]]},
        }
        self.client.force_authenticate(self.distributor_user)
        response = self.client.post(
            "/api/route-plans/generate/",
            {"dispatch_date": self.order.dispatch_date.isoformat()},
            format="json",
        )
        self.assertEqual(response.status_code, 201)
        route_plan = RoutePlan.objects.get(pk=response.data["id"])
        self.assertEqual(route_plan.status, RoutePlanStatus.DRAFT)
        self.assertEqual(route_plan.routing_status, "optimized")
        self.assertTrue(route_plan.route_number.startswith("HR-"))

        response = self.client.post(f"/api/route-plans/{route_plan.id}/confirm/", {"reviewed": True}, format="json")
        self.assertEqual(response.status_code, 200)
        self.order.refresh_from_db()
        self.assertEqual(self.order.status, "SCHEDULED")
        self.assertTrue(hasattr(self.order, "delivery"))

        response = self.client.post(f"/api/route-plans/{route_plan.id}/dispatch/")
        self.assertEqual(response.status_code, 200)
        self.order.refresh_from_db()
        self.assertEqual(self.order.status, "ON_THE_WAY")

        self.client.force_authenticate(self.driver_user)
        response = self.client.get("/api/routes/me/current/")
        self.assertEqual(response.status_code, 200)
        stop_id = response.data["stops"][0]["id"]

        response = self.client.post(f"/api/route-stops/{stop_id}/deliver/")
        self.assertEqual(response.status_code, 200)
        self.order.refresh_from_db()
        self.assertEqual(self.order.status, "DELIVERED")

    @override_settings(ORS_API_KEY="", OPENROUTESERVICE_API_KEY="")
    @patch("apps.routing.engine.ors_build_matrix")
    def test_generate_marks_over_capacity_orders_as_unassigned(self, build_matrix):
        build_matrix.return_value = {
            "durations_min": [[0, 20], [20, 0]],
            "distances_km": [[0, 12], [12, 0]],
        }
        self.product.weight = Decimal("1000.000")
        self.product.save(update_fields=["weight"])
        self.order.items.update(weight_kg=Decimal("1000.000"))
        self.client.force_authenticate(self.distributor_user)
        response = self.client.post(
            "/api/route-plans/generate/",
            {"dispatch_date": self.order.dispatch_date.isoformat()},
            format="json",
        )
        self.assertEqual(response.status_code, 201)
        self.assertEqual(response.data["total_runs"], 0)
        self.assertEqual(response.data["unassigned_summary"][0]["reason"], "capacity_exceeded")

    def test_generate_rejects_dates_without_orders(self):
        self.client.force_authenticate(self.distributor_user)
        response = self.client.post(
            "/api/route-plans/generate/",
            {"dispatch_date": (self.order.dispatch_date + timedelta(days=7)).isoformat()},
            format="json",
        )

        self.assertEqual(response.status_code, 400)
        self.assertIn("No hay pedidos para la fecha seleccionada.", str(response.data))
        self.assertEqual(RoutePlan.objects.count(), 0)

    @override_settings(ORS_API_KEY="", OPENROUTESERVICE_API_KEY="")
    def test_generate_falls_back_when_ors_key_is_missing(self):
        self.client.force_authenticate(self.distributor_user)

        response = self.client.post(
            "/api/route-plans/generate/",
            {"dispatch_date": self.order.dispatch_date.isoformat()},
            format="json",
        )

        self.assertEqual(response.status_code, 201)
        self.assertEqual(response.data["provider"], "manual")
        self.assertEqual(response.data["routing_status"], "fallback_no_ors_key")
        self.assertEqual(response.data["route_geometry"]["type"], "LineString")

    @override_settings(ORS_API_KEY="", OPENROUTESERVICE_API_KEY="")
    def test_generate_with_selected_vehicle_without_driver(self):
        vehicle = Vehicle.objects.create(
            distributor=self.distributor,
            plate="ZZ999ZZ",
            vehicle_type="Utilitario",
            capacity_kg=Decimal("500.00"),
            capacity_m3=Decimal("5.000"),
            insurance_expires_at=date.today() + timedelta(days=30),
            inspection_expires_at=date.today() + timedelta(days=30),
        )
        self.client.force_authenticate(self.distributor_user)

        response = self.client.post(
            "/api/route-plans/generate/",
            {"dispatch_date": self.order.dispatch_date.isoformat(), "vehicle_ids": [vehicle.id]},
            format="json",
        )

        self.assertEqual(response.status_code, 201)
        self.assertEqual(response.data["total_runs"], 1)
        self.assertEqual(response.data["runs"][0]["vehicle"], vehicle.id)
        self.assertIsNone(response.data["runs"][0]["driver"])
        self.assertEqual(response.data["runs"][0]["driver_name"], "Sin chofer asignado")

        confirm_response = self.client.post(f"/api/route-plans/{response.data['id']}/confirm/", {"reviewed": True}, format="json")
        self.assertEqual(confirm_response.status_code, 400)
        self.assertIn("chofer", str(confirm_response.data).lower())

    @override_settings(ORS_API_KEY="", OPENROUTESERVICE_API_KEY="")
    def test_preview_is_idempotent_for_same_key_and_payload(self):
        self.client.force_authenticate(self.distributor_user)
        payload = {"dispatch_date": self.order.dispatch_date.isoformat()}
        headers = {"HTTP_IDEMPOTENCY_KEY": "route-preview-test-1"}

        first = self.client.post("/api/route-plans/generate/", payload, format="json", **headers)
        second = self.client.post("/api/route-plans/generate/", payload, format="json", **headers)

        self.assertEqual(first.status_code, 201)
        self.assertEqual(second.status_code, 201)
        self.assertEqual(first.data["id"], second.data["id"])
        self.assertEqual(RoutePlan.objects.count(), 1)

    @override_settings(ORS_API_KEY="", OPENROUTESERVICE_API_KEY="")
    def test_reusing_idempotency_key_with_different_payload_fails(self):
        self.client.force_authenticate(self.distributor_user)
        headers = {"HTTP_IDEMPOTENCY_KEY": "route-preview-test-2"}

        first = self.client.post(
            "/api/route-plans/generate/",
            {"dispatch_date": self.order.dispatch_date.isoformat()},
            format="json",
            **headers,
        )
        second = self.client.post(
            "/api/route-plans/generate/",
            {"dispatch_date": (self.order.dispatch_date + timedelta(days=1)).isoformat()},
            format="json",
            **headers,
        )

        self.assertEqual(first.status_code, 201)
        self.assertEqual(second.status_code, 422)

    @override_settings(ORS_API_KEY="", OPENROUTESERVICE_API_KEY="")
    def test_confirmation_requires_review(self):
        self.client.force_authenticate(self.distributor_user)
        generate_response = self.client.post(
            "/api/route-plans/generate/",
            {"dispatch_date": self.order.dispatch_date.isoformat()},
            format="json",
        )

        response = self.client.post(f"/api/route-plans/{generate_response.data['id']}/confirm/", {}, format="json")

        self.assertEqual(response.status_code, 400)
        self.assertIn("revisar", str(response.data).lower())

    @override_settings(ORS_API_KEY="", OPENROUTESERVICE_API_KEY="")
    def test_pending_orders_exposes_commerce_coordinates(self):
        self.client.force_authenticate(self.distributor_user)

        response = self.client.get(f"/api/route-plans/pending-orders/?dispatch_date={self.order.dispatch_date.isoformat()}")

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data[0]["lat"], str(self.commerce.latitude))
        self.assertEqual(response.data[0]["lng"], str(self.commerce.longitude))
        self.assertTrue(response.data[0]["routable"])

    @override_settings(ORS_API_KEY="", OPENROUTESERVICE_API_KEY="")
    def test_routing_is_allowed_for_ia_plan(self):
        ia_plan, _ = Plan.objects.update_or_create(
            name="IA",
            defaults={"price": Decimal("2.00"), "description": "IA", "currency": "ARS", "is_active": True, "sort_order": 2},
        )
        self.distributor.subscription.plan = ia_plan
        self.distributor.subscription.save(update_fields=["plan"])
        self.distributor.plan_name = "IA"
        self.distributor.save(update_fields=["plan_name", "updated_at"])
        self.client.force_authenticate(self.distributor_user)

        response = self.client.post(
            "/api/route-plans/generate/",
            {"dispatch_date": self.order.dispatch_date.isoformat()},
            format="json",
        )

        self.assertEqual(response.status_code, 201)

    @override_settings(ORS_API_KEY="", OPENROUTESERVICE_API_KEY="")
    def test_routing_is_blocked_for_non_pro_or_ia_plan(self):
        start_plan, _ = Plan.objects.update_or_create(
            name="START",
            defaults={"price": Decimal("0.00"), "description": "Start", "currency": "ARS", "is_active": True, "sort_order": 0},
        )
        self.distributor.subscription.plan = start_plan
        self.distributor.subscription.save(update_fields=["plan"])
        self.distributor.plan_name = "START"
        self.distributor.save(update_fields=["plan_name", "updated_at"])
        self.client.force_authenticate(self.distributor_user)

        response = self.client.get(f"/api/route-plans/pending-orders/?dispatch_date={self.order.dispatch_date.isoformat()}")

        self.assertEqual(response.status_code, 403)

    @override_settings(ORS_API_KEY="", OPENROUTESERVICE_API_KEY="")
    @patch("apps.routing.engine.ors_build_matrix")
    def test_delete_route_plan_when_not_assigned_or_started(self, build_matrix):
        build_matrix.return_value = {
            "durations_min": [[0, 20], [20, 0]],
            "distances_km": [[0, 12], [12, 0]],
        }
        self.client.force_authenticate(self.distributor_user)
        generate_response = self.client.post(
            "/api/route-plans/generate/",
            {"dispatch_date": self.order.dispatch_date.isoformat()},
            format="json",
        )

        self.assertEqual(generate_response.status_code, 201)
        delete_response = self.client.delete(f"/api/route-plans/{generate_response.data['id']}/")

        self.assertEqual(delete_response.status_code, 204)
        self.assertFalse(RoutePlan.objects.exists())

    @override_settings(ORS_API_KEY="", OPENROUTESERVICE_API_KEY="")
    @patch("apps.routing.engine.ors_build_matrix")
    def test_delete_route_plan_rejects_assigned_routes(self, build_matrix):
        build_matrix.return_value = {
            "durations_min": [[0, 20], [20, 0]],
            "distances_km": [[0, 12], [12, 0]],
        }
        self.client.force_authenticate(self.distributor_user)
        generate_response = self.client.post(
            "/api/route-plans/generate/",
            {"dispatch_date": self.order.dispatch_date.isoformat()},
            format="json",
        )
        self.assertEqual(generate_response.status_code, 201)

        confirm_response = self.client.post(f"/api/route-plans/{generate_response.data['id']}/confirm/", {"reviewed": True}, format="json")
        self.assertEqual(confirm_response.status_code, 200)

        delete_response = self.client.delete(f"/api/route-plans/{generate_response.data['id']}/")

        self.assertEqual(delete_response.status_code, 400)
        self.assertIn("asignada a un chofer", str(delete_response.data))
        self.assertTrue(RoutePlan.objects.filter(pk=generate_response.data["id"]).exists())

    @override_settings(ORS_API_KEY="", OPENROUTESERVICE_API_KEY="")
    @patch("apps.routing.engine.ors_build_matrix")
    def test_edit_route_reorders_existing_stops(self, build_matrix):
        second_order = Order.objects.create(
            commerce=self.commerce,
            distributor=self.distributor,
            total=Decimal("100.00"),
            status="ACCEPTED",
            dispatch_date=self.order.dispatch_date,
            delivery_address="Cliente 2",
            delivery_latitude=Decimal("-34.5900000"),
            delivery_longitude=Decimal("-58.4300000"),
        )
        second_order.items.create(
            product=self.product,
            product_name=self.product.name,
            sku=self.product.sku,
            quantity=Decimal("1.000"),
            price=self.product.price,
            subtotal=self.product.price,
            weight_kg=Decimal("10.000"),
            volume_m3=Decimal("1.000000"),
        )
        build_matrix.return_value = {
            "durations_min": [
                [0, 10, 15],
                [10, 0, 8],
                [15, 8, 0],
            ],
            "distances_km": [
                [0, 5, 7],
                [5, 0, 4],
                [7, 4, 0],
            ],
        }
        self.client.force_authenticate(self.distributor_user)
        generate_response = self.client.post(
            "/api/route-plans/generate/",
            {"dispatch_date": self.order.dispatch_date.isoformat()},
            format="json",
        )
        self.assertEqual(generate_response.status_code, 201)
        run = generate_response.data["runs"][0]
        stop_ids = [stop["id"] for stop in run["stops"]]
        initial_order_ids = [stop["order"] for stop in run["stops"]]

        edit_response = self.client.post(
            f"/api/route-plans/{generate_response.data['id']}/edit/",
            {"runs": [{"id": run["id"], "stop_ids": list(reversed(stop_ids))}]},
            format="json",
        )
        self.assertEqual(edit_response.status_code, 200)
        edited_order_ids = [stop["order"] for stop in edit_response.data["runs"][0]["stops"]]
        self.assertEqual(edited_order_ids, list(reversed(initial_order_ids)))
        self.assertIn(second_order.id, edited_order_ids)
