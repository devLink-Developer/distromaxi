from decimal import Decimal

from django.contrib.auth import get_user_model
from django.test import TestCase
from rest_framework.test import APIClient

from apps.distributors.models import Distributor
from apps.inventory.models import StockItem, StockMovement, StockMovementType, Warehouse
from apps.products.models import Product, ProductSupplier

User = get_user_model()


class InventoryIntelligenceTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.user = User.objects.create_user(
            email="stock@test.local",
            password="Demo1234!",
            full_name="Stock Manager",
            role="DISTRIBUTOR",
        )
        self.distributor = Distributor.objects.create(
            owner=self.user,
            business_name="Stock Distro",
            tax_id="30-900",
            contact_name="Compras",
            email="stock@test.local",
            phone="111",
            subscription_status="ACTIVE",
        )
        self.supplier = ProductSupplier.objects.create(
            distributor=self.distributor,
            name="Proveedor Norte",
            lead_time_days=5,
        )
        self.product = Product.objects.create(
            distributor=self.distributor,
            supplier=self.supplier,
            sku="SKU-LOW",
            name="Gaseosa cola x 12",
            category="Bebidas",
            unit="bulto",
            price=Decimal("1000.00"),
            stock_minimum=Decimal("5.000"),
            stock_target=Decimal("10.000"),
            replenishment_multiple=Decimal("6.000"),
        )
        self.warehouse = Warehouse.objects.create(
            distributor=self.distributor,
            name="Central",
        )
        self.stock_item = StockItem.objects.create(
            distributor=self.distributor,
            warehouse=self.warehouse,
            product=self.product,
            quantity=Decimal("3.000"),
            reserved_quantity=Decimal("1.000"),
        )
        self.client.force_authenticate(self.user)

    def test_stock_summary_suggests_replenishment_for_low_stock(self):
        response = self.client.get("/api/stock/summary/?days=30")

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["kpis"]["total_skus"], 1)
        self.assertEqual(response.data["kpis"]["low_stock"], 1)
        self.assertEqual(response.data["kpis"]["suggested_skus"], 1)
        self.assertEqual(response.data["kpis"]["suggested_units"], "12.000")
        row = response.data["rows"][0]
        self.assertEqual(row["sku"], "SKU-LOW")
        self.assertEqual(row["available_quantity"], "2.000")
        self.assertEqual(row["recommended_qty"], "12.000")
        self.assertEqual(row["urgency"], "critical")
        self.assertEqual(row["lead_time_days"], 5)

    def test_replenishment_endpoint_returns_prioritized_rows(self):
        response = self.client.get("/api/stock/replenishment/?days=30")

        self.assertEqual(response.status_code, 200)
        self.assertEqual(len(response.data), 1)
        self.assertEqual(response.data[0]["stock_item_id"], self.stock_item.id)
        self.assertEqual(response.data[0]["recommended_qty"], "12.000")

    def test_stock_summary_includes_products_without_stock_item(self):
        product_without_stock = Product.objects.create(
            distributor=self.distributor,
            supplier=self.supplier,
            sku="SKU-ZERO",
            name="Producto sin stock inicial",
            category="Bebidas",
            unit="bulto",
            price=Decimal("500.00"),
        )

        response = self.client.get("/api/stock/summary/?days=30")

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["kpis"]["total_skus"], 2)
        row = next(item for item in response.data["rows"] if item["sku"] == "SKU-ZERO")
        self.assertEqual(row["quantity"], "0.000")
        self.assertEqual(row["reserved_quantity"], "0.000")
        self.assertEqual(row["available_quantity"], "0.000")
        self.assertEqual(row["urgency"], "out_of_stock")
        self.assertTrue(StockItem.objects.filter(product=product_without_stock).exists())

    def test_cycle_count_creates_adjustment_movement(self):
        response = self.client.post(
            f"/api/stock/{self.stock_item.id}/cycle-count/",
            {"counted_quantity": "7.000", "note": "Conteo semanal"},
            format="json",
        )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["difference"], "4.000")
        self.stock_item.refresh_from_db()
        self.assertEqual(self.stock_item.quantity, Decimal("7.000"))
        movement = StockMovement.objects.get(product=self.product, movement_type=StockMovementType.ADJUSTMENT)
        self.assertEqual(movement.quantity, Decimal("4.000"))
        self.assertEqual(movement.note, "Conteo semanal")

    def test_stock_movements_can_be_filtered_by_product_warehouse_and_type(self):
        StockMovement.objects.create(
            distributor=self.distributor,
            warehouse=self.warehouse,
            product=self.product,
            movement_type=StockMovementType.ADJUSTMENT,
            quantity=Decimal("2.000"),
            note="Ajuste",
        )
        response = self.client.get(
            f"/api/stock-movements/?product={self.product.id}&warehouse={self.warehouse.id}&movement_type=ADJUSTMENT"
        )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(len(response.data), 1)
        self.assertEqual(response.data[0]["movement_type"], StockMovementType.ADJUSTMENT)
