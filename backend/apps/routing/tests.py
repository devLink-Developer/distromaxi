from datetime import date, timedelta
from decimal import Decimal
from unittest.mock import patch

from django.contrib.auth import get_user_model
from django.core.exceptions import ImproperlyConfigured
from django.test import TestCase
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

    @patch("apps.routing.engine.ors_build_matrix")
    def test_generate_confirm_dispatch_and_complete_route(self, build_matrix):
        build_matrix.return_value = {
            "durations_min": [[0, 20], [20, 0]],
            "distances_km": [[0, 12], [12, 0]],
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

        response = self.client.post(f"/api/route-plans/{route_plan.id}/confirm/")
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

    @patch("apps.routing.engine.ors_build_matrix")
    def test_generate_marks_over_capacity_orders_as_unassigned(self, build_matrix):
        build_matrix.return_value = {
            "durations_min": [[0, 20], [20, 0]],
            "distances_km": [[0, 12], [12, 0]],
        }
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

    @patch("apps.routing.engine.ors_build_matrix")
    def test_generate_returns_validation_error_when_ors_key_is_missing(self, build_matrix):
        build_matrix.side_effect = ImproperlyConfigured("Missing OPENROUTESERVICE_API_KEY.")
        self.client.force_authenticate(self.distributor_user)

        response = self.client.post(
            "/api/route-plans/generate/",
            {"dispatch_date": self.order.dispatch_date.isoformat()},
            format="json",
        )

        self.assertEqual(response.status_code, 400)
        self.assertIn("OPENROUTESERVICE_API_KEY", str(response.data))

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

        confirm_response = self.client.post(f"/api/route-plans/{generate_response.data['id']}/confirm/")
        self.assertEqual(confirm_response.status_code, 200)

        delete_response = self.client.delete(f"/api/route-plans/{generate_response.data['id']}/")

        self.assertEqual(delete_response.status_code, 400)
        self.assertIn("asignada a un chofer", str(delete_response.data))
        self.assertTrue(RoutePlan.objects.filter(pk=generate_response.data["id"]).exists())

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
