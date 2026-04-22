from datetime import date, timedelta
from decimal import Decimal
from unittest.mock import patch

from django.contrib.auth import get_user_model
from django.test import TestCase
from rest_framework.test import APIClient

from apps.billing.models import Plan, Subscription
from apps.commerces.models import Commerce
from apps.deliveries.models import Delivery
from apps.distributors.models import Distributor
from apps.fleet.models import DriverProfile, Vehicle
from apps.orders.models import Order
from apps.products.models import Product

User = get_user_model()


class DeliveryRoutingMetadataTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.distributor_user = User.objects.create_user(
            email="dist@test.local",
            password="Demo1234!",
            full_name="Distribuidor",
            role="DISTRIBUTOR",
        )
        self.driver_user = User.objects.create_user(
            email="driver@test.local",
            password="Demo1234!",
            full_name="Chofer",
            role="DRIVER",
        )
        self.distributor = Distributor.objects.create(
            owner=self.distributor_user,
            business_name="Distribuidora",
            tax_id="30-1",
            contact_name="Ventas",
            email="dist@test.local",
            phone="111",
            address="Base",
            latitude=Decimal("-34.6037220"),
            longitude=Decimal("-58.3815920"),
            plan_name="PRO",
            subscription_status="ACTIVE",
            active=True,
        )
        plan, _ = Plan.objects.update_or_create(
            name="PRO",
            defaults={"price": Decimal("1.00"), "description": "Pro", "currency": "ARS", "is_active": True, "sort_order": 1},
        )
        Subscription.objects.update_or_create(
            distributor=self.distributor,
            defaults={"plan": plan, "status": "ACTIVE", "starts_at": date.today(), "expires_at": date.today() + timedelta(days=30)},
        )
        self.commerce = Commerce.objects.create(
            distributor=self.distributor,
            trade_name="Cliente",
            contact_name="Compras",
            phone="222",
            address="Destino",
            latitude=Decimal("-34.5841000"),
            longitude=Decimal("-58.4351000"),
        )
        self.vehicle = Vehicle.objects.create(
            distributor=self.distributor,
            plate="AA111AA",
            vehicle_type="Utilitario",
            capacity_kg=Decimal("500.00"),
            capacity_m3=Decimal("6.000"),
            insurance_expires_at=date.today() + timedelta(days=30),
            inspection_expires_at=date.today() + timedelta(days=30),
        )
        self.driver = DriverProfile.objects.create(
            user=self.driver_user,
            distributor=self.distributor,
            license_number="B1",
            license_category="B1",
            phone="333",
            assigned_vehicle=self.vehicle,
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
        self.order = Order.objects.create(
            commerce=self.commerce,
            distributor=self.distributor,
            total=Decimal("100.00"),
            status="SCHEDULED",
            dispatch_date=date.today() + timedelta(days=1),
            delivery_address=self.commerce.address,
            delivery_latitude=self.commerce.latitude,
            delivery_longitude=self.commerce.longitude,
        )
        self.delivery = Delivery.objects.create(order=self.order, driver=self.driver, vehicle=self.vehicle)

    @patch("apps.routing.engine.ors_build_matrix")
    def test_delivery_endpoint_exposes_route_metadata_after_confirmation(self, build_matrix):
        from apps.routing.engine import generate_route_plan
        from apps.routing.models import RouteStop

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
        build_matrix.return_value = {
            "durations_min": [[0, 10], [10, 0]],
            "distances_km": [[0, 5], [5, 0]],
        }
        route_plan = generate_route_plan(
            distributor=self.distributor,
            dispatch_date=self.order.dispatch_date,
            generated_by=self.distributor_user,
        )
        self.client.force_authenticate(self.distributor_user)
        self.client.post(f"/api/route-plans/{route_plan.id}/confirm/")
        RouteStop.objects.get(order=self.order)

        response = self.client.get(f"/api/deliveries/{self.delivery.id}/")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["stop_sequence"], 1)
        self.assertIsNotNone(response.data["planned_eta"])
