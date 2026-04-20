from django.db import models


class OrderStatus(models.TextChoices):
    PENDING = "PENDING", "Pendiente"
    ACCEPTED = "ACCEPTED", "Aceptado"
    PREPARING = "PREPARING", "Preparando"
    ON_THE_WAY = "ON_THE_WAY", "En camino"
    DELIVERED = "DELIVERED", "Entregado"
    CANCELLED = "CANCELLED", "Cancelado"


class Order(models.Model):
    commerce = models.ForeignKey("commerces.Commerce", on_delete=models.PROTECT, related_name="orders")
    distributor = models.ForeignKey("distributors.Distributor", on_delete=models.PROTECT, related_name="orders")
    total = models.DecimalField(max_digits=14, decimal_places=2, default=0)
    status = models.CharField(max_length=20, choices=OrderStatus.choices, default=OrderStatus.PENDING)
    delivery_address = models.CharField(max_length=255)
    delivery_latitude = models.DecimalField(max_digits=10, decimal_places=7, null=True, blank=True)
    delivery_longitude = models.DecimalField(max_digits=10, decimal_places=7, null=True, blank=True)
    notes = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=["distributor", "created_at"]),
            models.Index(fields=["distributor", "status"]),
            models.Index(fields=["commerce", "created_at"]),
        ]

    def __str__(self):
        return f"Pedido #{self.pk} - {self.status}"


class OrderItem(models.Model):
    order = models.ForeignKey(Order, on_delete=models.CASCADE, related_name="items")
    product = models.ForeignKey("products.Product", on_delete=models.PROTECT)
    product_name = models.CharField(max_length=180)
    sku = models.CharField(max_length=80)
    quantity = models.DecimalField(max_digits=12, decimal_places=3)
    price = models.DecimalField(max_digits=12, decimal_places=2)
    subtotal = models.DecimalField(max_digits=14, decimal_places=2)

    class Meta:
        ordering = ["id"]
        indexes = [
            models.Index(fields=["product"]),
            models.Index(fields=["order"]),
        ]

    def __str__(self):
        return f"{self.quantity} x {self.product_name}"

# Create your models here.
