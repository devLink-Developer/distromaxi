from datetime import date, timedelta
from decimal import Decimal

from django.contrib.auth import get_user_model
from django.test import TestCase
from django.utils import timezone
from rest_framework.test import APIClient

from apps.commerces.models import Commerce
from apps.deliveries.models import Delivery
from apps.distributors.models import Distributor
from apps.fleet.models import DriverProfile, Vehicle
from apps.inventory.models import StockItem
from apps.inventory.services import ensure_default_warehouse
from apps.orders.models import Order, OrderItem
from apps.products.models import Product

User = get_user_model()


class DashboardApiTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.distributor_user = User.objects.create_user(
            email="dashboard-dist@test.local",
            password="Demo1234!",
            full_name="Distribuidor",
            role="DISTRIBUTOR",
        )
        self.other_user = User.objects.create_user(
            email="other-dist@test.local",
            password="Demo1234!",
            full_name="Otro distribuidor",
            role="DISTRIBUTOR",
        )
        self.commerce_user = User.objects.create_user(
            email="dashboard-commerce@test.local",
            password="Demo1234!",
            full_name="Comercio",
            role="COMMERCE",
        )
        self.driver_user = User.objects.create_user(
            email="dashboard-driver@test.local",
            password="Demo1234!",
            full_name="Chofer",
            role="DRIVER",
        )
        self.distributor = Distributor.objects.create(
            owner=self.distributor_user,
            business_name="Distro Dashboard",
            tax_id="30-90000000-1",
            contact_name="Ventas",
            email="dist@test.local",
            phone="111",
            address="Base 1",
            subscription_status="ACTIVE",
        )
        self.other_distributor = Distributor.objects.create(
            owner=self.other_user,
            business_name="Otra Distro",
            tax_id="30-90000000-2",
            contact_name="Ventas",
            email="other@test.local",
            phone="222",
            address="Base 2",
            subscription_status="ACTIVE",
        )
        self.commerce = Commerce.objects.create(
            user=self.commerce_user,
            distributor=self.distributor,
            trade_name="Autoservicio Centro",
            tax_id="20-90000000-1",
            contact_name="Compras",
            phone="333",
            address="Cliente 1",
            city="Rosario",
            province="Santa Fe",
        )
        self.product = Product.objects.create(
            distributor=self.distributor,
            sku="DASH-1",
            name="Gaseosa cola x 6",
            category="Bebidas",
            unit="bulto",
            price=Decimal("1000.00"),
            cost=Decimal("700.00"),
            stock_minimum=Decimal("2.000"),
        )
        self.second_product = Product.objects.create(
            distributor=self.distributor,
            sku="DASH-2",
            name="Agua sin gas x 12",
            category="Bebidas",
            unit="bulto",
            price=Decimal("500.00"),
            cost=Decimal("320.00"),
            stock_minimum=Decimal("5.000"),
        )
        self.other_product = Product.objects.create(
            distributor=self.other_distributor,
            sku="OTHER-1",
            name="Producto externo",
            category="Varios",
            unit="unidad",
            price=Decimal("999.00"),
            cost=Decimal("100.00"),
        )
        warehouse = ensure_default_warehouse(self.distributor)
        StockItem.objects.create(
            distributor=self.distributor,
            warehouse=warehouse,
            product=self.product,
            quantity=Decimal("20.000"),
            reserved_quantity=Decimal("0.000"),
        )
        StockItem.objects.create(
            distributor=self.distributor,
            warehouse=warehouse,
            product=self.second_product,
            quantity=Decimal("1.000"),
            reserved_quantity=Decimal("0.000"),
        )
        self.order = Order.objects.create(
            commerce=self.commerce,
            distributor=self.distributor,
            total=Decimal("2500.00"),
            status="DELIVERED",
            delivery_address="Cliente 1",
        )
        OrderItem.objects.create(
            order=self.order,
            product=self.product,
            product_name=self.product.name,
            sku=self.product.sku,
            quantity=Decimal("2.000"),
            price=self.product.price,
            subtotal=Decimal("2000.00"),
        )
        OrderItem.objects.create(
            order=self.order,
            product=self.second_product,
            product_name=self.second_product.name,
            sku=self.second_product.sku,
            quantity=Decimal("1.000"),
            price=self.second_product.price,
            subtotal=Decimal("500.00"),
        )
        second_order = Order.objects.create(
            commerce=self.commerce,
            distributor=self.distributor,
            total=Decimal("1000.00"),
            status="ACCEPTED",
            delivery_address="Cliente 1",
        )
        OrderItem.objects.create(
            order=second_order,
            product=self.product,
            product_name=self.product.name,
            sku=self.product.sku,
            quantity=Decimal("1.000"),
            price=self.product.price,
            subtotal=Decimal("1000.00"),
        )
        other_order = Order.objects.create(
            commerce=self.commerce,
            distributor=self.other_distributor,
            total=Decimal("999.00"),
            status="DELIVERED",
            delivery_address="Cliente externo",
        )
        OrderItem.objects.create(
            order=other_order,
            product=self.other_product,
            product_name=self.other_product.name,
            sku=self.other_product.sku,
            quantity=Decimal("1.000"),
            price=self.other_product.price,
            subtotal=Decimal("999.00"),
        )
        vehicle = Vehicle.objects.create(
            distributor=self.distributor,
            plate="AD111DD",
            vehicle_type="Utilitario",
            insurance_expires_at=date.today() + timedelta(days=30),
            inspection_expires_at=date.today() + timedelta(days=30),
        )
        driver = DriverProfile.objects.create(
            user=self.driver_user,
            distributor=self.distributor,
            license_number="LIC-1",
            license_category="B1",
            phone="444",
            assigned_vehicle=vehicle,
        )
        Delivery.objects.create(order=self.order, driver=driver, vehicle=vehicle, status="DELIVERED")
        self.client.force_authenticate(self.distributor_user)

    def date_query(self):
        today = timezone.localdate().isoformat()
        return f"?date_from={today}&date_to={today}"

    def test_dashboard_endpoints_are_scoped_and_complete(self):
        summary = self.client.get(f"/api/dashboard/summary{self.date_query()}")
        self.assertEqual(summary.status_code, 200)
        self.assertEqual(summary.data["kpis"]["orders"], 2)
        self.assertEqual(summary.data["kpis"]["sales_period"], 3500.0)

        sales = self.client.get(f"/api/dashboard/sales{self.date_query()}&zone=Rosario")
        self.assertEqual(sales.status_code, 200)
        self.assertEqual(sales.data["by_zone"][0]["name"], "Rosario")
        self.assertEqual(sales.data["by_zone"][0]["sales"], 3500.0)
        self.assertNotIn("by_seller", sales.data)
        self.assertNotIn("by_channel", sales.data)
        self.assertNotIn("Producto externo", [row["name"] for row in sales.data["top_products"]])

        customers = self.client.get(f"/api/dashboard/customers{self.date_query()}")
        products = self.client.get(f"/api/dashboard/products{self.date_query()}")
        operations = self.client.get(f"/api/dashboard/operations{self.date_query()}")
        self.assertEqual(customers.status_code, 200)
        self.assertEqual(products.status_code, 200)
        self.assertEqual(operations.status_code, 200)
        self.assertEqual(customers.data["ranking"][0]["name"], "Autoservicio Centro")
        self.assertTrue(products.data["stock_breaks"])
        self.assertEqual(operations.data["riders"][0]["delivered"], 1)

    def test_dashboard_sales_export_csv(self):
        response = self.client.get(f"/api/dashboard/sales{self.date_query()}&format=csv")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response["Content-Type"], "text/csv; charset=utf-8")
        self.assertIn("Ventas", response.content.decode("utf-8"))
