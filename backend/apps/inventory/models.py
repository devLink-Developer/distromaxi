from decimal import Decimal

from django.db import models


class Warehouse(models.Model):
    distributor = models.ForeignKey(
        "distributors.Distributor",
        on_delete=models.PROTECT,
        related_name="warehouses",
    )
    name = models.CharField(max_length=120)
    address = models.CharField(max_length=255, blank=True)
    active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["name"]
        unique_together = [("distributor", "name")]

    def __str__(self):
        return f"{self.distributor} / {self.name}"


class StockItem(models.Model):
    distributor = models.ForeignKey(
        "distributors.Distributor",
        on_delete=models.PROTECT,
        related_name="stock_items",
    )
    warehouse = models.ForeignKey(Warehouse, on_delete=models.PROTECT, related_name="stock_items")
    product = models.ForeignKey("products.Product", on_delete=models.PROTECT, related_name="stock_items")
    quantity = models.DecimalField(max_digits=12, decimal_places=3, default=0)
    reserved_quantity = models.DecimalField(max_digits=12, decimal_places=3, default=0)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["product__name"]
        unique_together = [("warehouse", "product")]

    def __str__(self):
        return f"{self.product} x {self.available_quantity}"

    @property
    def available_quantity(self):
        return self.quantity - self.reserved_quantity

    @property
    def is_low(self):
        return self.available_quantity <= self.product.stock_minimum

    def adjust(self, delta):
        self.quantity = Decimal(self.quantity) + Decimal(delta)
        self.save(update_fields=["quantity", "updated_at"])


class StockMovementType(models.TextChoices):
    IN = "IN", "Ingreso"
    OUT = "OUT", "Salida"
    RESERVED = "RESERVED", "Reservado"
    RELEASED = "RELEASED", "Liberado"
    ADJUSTMENT = "ADJUSTMENT", "Ajuste"


class StockMovement(models.Model):
    distributor = models.ForeignKey("distributors.Distributor", on_delete=models.PROTECT)
    warehouse = models.ForeignKey(Warehouse, on_delete=models.PROTECT)
    product = models.ForeignKey("products.Product", on_delete=models.PROTECT)
    order = models.ForeignKey("orders.Order", on_delete=models.SET_NULL, null=True, blank=True)
    movement_type = models.CharField(max_length=20, choices=StockMovementType.choices)
    quantity = models.DecimalField(max_digits=12, decimal_places=3)
    note = models.CharField(max_length=255, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        return f"{self.movement_type} {self.quantity} {self.product}"

# Create your models here.
