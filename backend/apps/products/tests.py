from django.contrib.auth import get_user_model
from django.test import TestCase
from rest_framework.test import APIClient

from apps.distributors.models import Distributor

from .models import Product


class ProductConfigurationApiTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.user = get_user_model().objects.create_user(
            email="ventas@test.local",
            password="Demo1234!",
            full_name="Ventas Test",
            role="DISTRIBUTOR",
        )
        self.distributor = Distributor.objects.create(
            owner=self.user,
            business_name="Distribuidora Test",
            tax_id="30-99999999-1",
            contact_name="Ventas",
            email="ventas@test.local",
            phone="111",
            address="Calle 1",
        )
        self.client.force_authenticate(self.user)

    def test_seller_configures_supplier_category_and_product_logistics(self):
        supplier = self.client.post(
            "/api/product-suppliers/",
            {"name": "Proveedor Norte", "contact_name": "Compras", "active": True},
            format="json",
        )
        category = self.client.post(
            "/api/product-categories/",
            {"name": "Bebidas", "active": True},
            format="json",
        )
        subcategory = self.client.post(
            "/api/product-subcategories/",
            {"category": category.data["id"], "name": "Aguas", "active": True},
            format="json",
        )

        response = self.client.post(
            "/api/products/",
            {
                "supplier": supplier.data["id"],
                "product_category": category.data["id"],
                "product_subcategory": subcategory.data["id"],
                "sku": "SKU-AGUA-6",
                "barcode": "7790001",
                "name": "Agua mineral 1.5L x 6",
                "brand": "Andina",
                "unit": "bulto",
                "package_size": "6 unidades",
                "length": "40.000",
                "width": "30.000",
                "height": "25.000",
                "dimension_unit": "cm",
                "weight": "8.500",
                "weight_unit": "kg",
                "units_per_package": 6,
                "packages_per_pallet": 60,
                "units_per_pallet": 360,
                "price": "3250.00",
                "costo": "2340.00",
                "porc_descuento": "12.50",
                "nombre_descuento": "Promo lanzamiento",
                "caracteristicas": "Sin gas. Pack retornable.",
                "stock_minimum": "10.000",
            },
            format="json",
        )

        self.assertEqual(response.status_code, 201)
        self.assertEqual(response.data["supplier_name"], "Proveedor Norte")
        self.assertEqual(response.data["category"], "Bebidas")
        self.assertEqual(response.data["subcategory"], "Aguas")
        self.assertEqual(response.data["units_per_package"], 6)
        self.assertEqual(response.data["packages_per_pallet"], 60)
        self.assertEqual(response.data["units_per_pallet"], 360)
        self.assertEqual(response.data["cost"], "2340.00")
        self.assertEqual(response.data["costo"], "2340.00")
        self.assertEqual(response.data["discount_percent"], "12.50")
        self.assertEqual(response.data["porc_descuento"], "12.50")
        self.assertEqual(response.data["discount_name"], "Promo lanzamiento")
        self.assertEqual(response.data["nombre_descuento"], "Promo lanzamiento")
        self.assertEqual(response.data["characteristics"], "Sin gas. Pack retornable.")
        self.assertEqual(response.data["caracteristicas"], "Sin gas. Pack retornable.")

        product = Product.objects.get(sku="SKU-AGUA-6")
        self.assertEqual(product.distributor, self.distributor)
        self.assertEqual(product.product_category_id, category.data["id"])
        self.assertEqual(product.product_subcategory_id, subcategory.data["id"])
        self.assertEqual(str(product.cost), "2340.00")
        self.assertEqual(str(product.discount_percent), "12.50")
        self.assertEqual(product.discount_name, "Promo lanzamiento")
        self.assertEqual(product.characteristics, "Sin gas. Pack retornable.")

    def test_legacy_category_text_creates_configured_category(self):
        response = self.client.post(
            "/api/products/",
            {
                "sku": "SKU-YERBA-10",
                "name": "Yerba mate 1kg x 10",
                "brand": "Monte Verde",
                "category": "Infusiones",
                "unit": "bulto",
                "length": "38.000",
                "width": "28.000",
                "height": "22.000",
                "dimension_unit": "cm",
                "weight": "10.000",
                "weight_unit": "kg",
                "units_per_package": 10,
                "price": "28200.00",
            },
            format="json",
        )

        self.assertEqual(response.status_code, 201)
        self.assertEqual(response.data["category"], "Infusiones")
        self.assertEqual(response.data["category_name"], "Infusiones")
