from datetime import date, timedelta
from decimal import Decimal

from django.contrib.auth import get_user_model
from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import TestCase
from rest_framework.test import APIClient

from apps.commerces.models import Commerce
from apps.deliveries.models import Delivery
from apps.distributors.models import Distributor
from apps.fleet.models import DriverProfile, Vehicle
from apps.inventory.models import StockItem
from apps.inventory.services import adjust_stock, ensure_default_warehouse
from apps.orders.models import Order
from apps.products.models import Product

User = get_user_model()


class DistroMaxiFlowTests(TestCase):
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
        self.commerce_user = User.objects.create_user(
            email="commerce@test.local",
            password="Demo1234!",
            full_name="Comercio",
            role="COMMERCE",
        )
        self.driver_user = User.objects.create_user(
            email="driver@test.local",
            password="Demo1234!",
            full_name="Chofer",
            role="DRIVER",
        )
        self.distributor = Distributor.objects.create(
            owner=self.distributor_user,
            business_name="Test Distro",
            tax_id="30-1",
            contact_name="Ventas",
            email="dist@test.local",
            phone="111",
            address="Base 1",
            subscription_status="ACTIVE",
        )
        self.commerce = Commerce.objects.create(
            user=self.commerce_user,
            distributor=self.distributor,
            trade_name="Kiosco Test",
            tax_id="20-1",
            contact_name="Compras",
            phone="222",
            postal_code="1414",
            address="Cliente 1",
            city="CABA",
            province="CABA",
            latitude=Decimal("-34.5841000"),
            longitude=Decimal("-58.4351000"),
            default_window_start="08:00",
            default_window_end="14:00",
        )
        self.product = Product.objects.create(
            distributor=self.distributor,
            sku="SKU-1",
            name="Agua x 6",
            category="Bebidas",
            unit="bulto",
            weight=Decimal("8.000"),
            weight_unit="kg",
            length=Decimal("40.000"),
            width=Decimal("30.000"),
            height=Decimal("25.000"),
            dimension_unit="cm",
            price=Decimal("100.00"),
            stock_minimum=Decimal("2.000"),
        )
        self.warehouse = ensure_default_warehouse(self.distributor)
        adjust_stock(self.product, Decimal("10.000"), note="test", warehouse=self.warehouse)
        self.vehicle = Vehicle.objects.create(
            distributor=self.distributor,
            plate="AA111AA",
            vehicle_type="Utilitario",
            insurance_expires_at=date.today() + timedelta(days=90),
            inspection_expires_at=date.today() + timedelta(days=90),
        )
        self.driver = DriverProfile.objects.create(
            user=self.driver_user,
            distributor=self.distributor,
            license_number="B123",
            license_category="B1",
            phone="333",
            assigned_vehicle=self.vehicle,
        )

    def test_login_returns_jwt_and_user(self):
        response = self.client.post(
            "/api/auth/login",
            {"email": "dist@test.local", "password": "Demo1234!"},
            format="json",
        )
        self.assertEqual(response.status_code, 200)
        self.assertIn("access", response.data)
        self.assertEqual(response.data["user"]["role"], "DISTRIBUTOR")

    def test_commerce_order_reserves_and_delivered_commits_stock(self):
        self.client.force_authenticate(self.commerce_user)
        response = self.client.post(
            "/api/orders/",
            {
                "delivery_address": "Cliente 1",
                "line_items": [{"product_id": self.product.id, "quantity": "3.000"}],
            },
            format="json",
        )
        self.assertEqual(response.status_code, 201)
        order_id = response.data["id"]
        order = Order.objects.get(pk=order_id)
        self.assertIsNotNone(order.dispatch_date)
        self.assertEqual(str(order.delivery_window_start), "08:00:00")
        self.assertEqual(str(order.delivery_window_end), "14:00:00")
        item = order.items.get()
        self.assertEqual(item.weight_kg, Decimal("24.000"))
        self.assertEqual(item.volume_m3, Decimal("0.090000"))
        stock = StockItem.objects.get(product=self.product)
        self.assertEqual(stock.quantity, Decimal("10.000"))
        self.assertEqual(stock.reserved_quantity, Decimal("3.000"))

        response = self.client.patch(f"/api/orders/{order_id}/status/", {"status": "DELIVERED"}, format="json")
        self.assertEqual(response.status_code, 200)
        stock.refresh_from_db()
        self.assertEqual(stock.quantity, Decimal("7.000"))
        self.assertEqual(stock.reserved_quantity, Decimal("0.000"))

    def test_import_products_csv(self):
        self.client.force_authenticate(self.distributor_user)
        csv_file = SimpleUploadedFile(
            "products.csv",
            b"sku,name,category,unit,price,costo,porc_descuento,nombre_descuento,caracteristicas,stock_minimum\nSKU-2,Yerba x 10,Infusiones,bulto,5000,3500,10,Promo,Paquete mayorista,4\n",
            content_type="text/csv",
        )
        response = self.client.post(
            "/api/imports/upload/",
            {"entity_type": "products", "file": csv_file},
            format="multipart",
        )
        self.assertEqual(response.status_code, 201)
        self.assertEqual(response.data["processed_rows"], 1)
        product = Product.objects.get(distributor=self.distributor, sku="SKU-2")
        self.assertEqual(product.cost, Decimal("3500.00"))
        self.assertEqual(product.discount_percent, Decimal("10.00"))
        self.assertEqual(product.discount_name, "Promo")
        self.assertEqual(product.characteristics, "Paquete mayorista")

    def test_commerce_cannot_order_without_geolocated_address(self):
        self.commerce.latitude = None
        self.commerce.longitude = None
        self.commerce.save(update_fields=["latitude", "longitude", "updated_at"])
        self.client.force_authenticate(self.commerce_user)
        response = self.client.post(
            "/api/orders/",
            {
                "line_items": [{"product_id": self.product.id, "quantity": "1.000"}],
            },
            format="json",
        )

        self.assertEqual(response.status_code, 400)
        self.assertIn("delivery_address", response.data)

    def test_delivery_location_tracking(self):
        order = Order.objects.create(
            commerce=self.commerce,
            distributor=self.distributor,
            total=Decimal("100.00"),
            delivery_address="Cliente 1",
        )
        delivery = Delivery.objects.create(order=order, driver=self.driver, vehicle=self.vehicle)
        self.client.force_authenticate(self.driver_user)
        response = self.client.patch(
            f"/api/deliveries/{delivery.id}/location/",
            {"latitude": "-34.6000000", "longitude": "-58.4000000", "accuracy_m": "12.50"},
            format="json",
        )
        self.assertEqual(response.status_code, 200)
        delivery.refresh_from_db()
        self.assertEqual(delivery.locations.count(), 1)
        self.assertEqual(delivery.status, "ON_THE_WAY")

# Create your tests here.
