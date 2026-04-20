from django.db import models
from django.core.validators import MaxValueValidator, MinValueValidator


class ProductSupplier(models.Model):
    distributor = models.ForeignKey(
        "distributors.Distributor",
        on_delete=models.CASCADE,
        related_name="product_suppliers",
    )
    name = models.CharField(max_length=160)
    contact_name = models.CharField(max_length=160, blank=True)
    phone = models.CharField(max_length=60, blank=True)
    email = models.EmailField(blank=True)
    active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["name"]
        unique_together = [("distributor", "name")]
        indexes = [
            models.Index(fields=["distributor", "active"]),
            models.Index(fields=["distributor", "name"]),
        ]

    def __str__(self):
        return self.name


class ProductCategory(models.Model):
    distributor = models.ForeignKey(
        "distributors.Distributor",
        on_delete=models.CASCADE,
        related_name="product_categories",
    )
    name = models.CharField(max_length=120)
    active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["name"]
        unique_together = [("distributor", "name")]
        indexes = [
            models.Index(fields=["distributor", "active"]),
            models.Index(fields=["distributor", "name"]),
        ]

    def __str__(self):
        return self.name


class ProductSubCategory(models.Model):
    distributor = models.ForeignKey(
        "distributors.Distributor",
        on_delete=models.CASCADE,
        related_name="product_subcategories",
    )
    category = models.ForeignKey(ProductCategory, on_delete=models.CASCADE, related_name="subcategories")
    name = models.CharField(max_length=120)
    active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["category__name", "name"]
        unique_together = [("category", "name")]
        indexes = [
            models.Index(fields=["distributor", "active"]),
            models.Index(fields=["category", "name"]),
        ]

    def __str__(self):
        return f"{self.category} / {self.name}"


class Product(models.Model):
    class DimensionUnit(models.TextChoices):
        CM = "cm", "cm"
        M = "m", "m"
        MM = "mm", "mm"

    class WeightUnit(models.TextChoices):
        KG = "kg", "kg"
        G = "g", "g"

    distributor = models.ForeignKey(
        "distributors.Distributor",
        on_delete=models.PROTECT,
        related_name="products",
    )
    supplier = models.ForeignKey(ProductSupplier, on_delete=models.SET_NULL, null=True, blank=True, related_name="products")
    product_category = models.ForeignKey(ProductCategory, on_delete=models.SET_NULL, null=True, blank=True, related_name="products")
    product_subcategory = models.ForeignKey(ProductSubCategory, on_delete=models.SET_NULL, null=True, blank=True, related_name="products")
    sku = models.CharField(max_length=80)
    barcode = models.CharField(max_length=80, blank=True)
    name = models.CharField(max_length=180)
    description = models.TextField(blank=True)
    brand = models.CharField(max_length=120, blank=True)
    category = models.CharField(max_length=120)
    subcategory = models.CharField(max_length=120, blank=True)
    unit = models.CharField(max_length=40, default="unidad")
    package_size = models.CharField(max_length=80, blank=True)
    length = models.DecimalField(max_digits=10, decimal_places=3, default=0)
    width = models.DecimalField(max_digits=10, decimal_places=3, default=0)
    height = models.DecimalField(max_digits=10, decimal_places=3, default=0)
    dimension_unit = models.CharField(max_length=8, choices=DimensionUnit.choices, default=DimensionUnit.CM)
    weight = models.DecimalField(max_digits=10, decimal_places=3, default=0)
    weight_unit = models.CharField(max_length=8, choices=WeightUnit.choices, default=WeightUnit.KG)
    units_per_package = models.PositiveIntegerField(default=1)
    packages_per_pallet = models.PositiveIntegerField(null=True, blank=True)
    units_per_pallet = models.PositiveIntegerField(null=True, blank=True)
    price = models.DecimalField(max_digits=12, decimal_places=2)
    cost = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    discount_percent = models.DecimalField(max_digits=5, decimal_places=2, default=0, validators=[MinValueValidator(0), MaxValueValidator(100)])
    discount_name = models.CharField(max_length=120, blank=True)
    characteristics = models.TextField(blank=True)
    image_url = models.URLField(blank=True)
    stock_minimum = models.DecimalField(max_digits=12, decimal_places=3, default=0)
    active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["name"]
        unique_together = [("distributor", "sku")]
        indexes = [
            models.Index(fields=["distributor", "category"]),
            models.Index(fields=["distributor", "subcategory"]),
            models.Index(fields=["distributor", "active"]),
            models.Index(fields=["sku"]),
        ]

    def __str__(self):
        return f"{self.sku} - {self.name}"

# Create your models here.
