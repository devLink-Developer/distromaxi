from django.db import models


class DeliveryStatus(models.TextChoices):
    ASSIGNED = "ASSIGNED", "Asignada"
    PICKED_UP = "PICKED_UP", "Retirada"
    ON_THE_WAY = "ON_THE_WAY", "En camino"
    DELIVERED = "DELIVERED", "Entregada"
    CANCELLED = "CANCELLED", "Cancelada"


class Delivery(models.Model):
    order = models.OneToOneField("orders.Order", on_delete=models.PROTECT, related_name="delivery")
    driver = models.ForeignKey("fleet.DriverProfile", on_delete=models.PROTECT, related_name="deliveries")
    vehicle = models.ForeignKey("fleet.Vehicle", on_delete=models.PROTECT, related_name="deliveries")
    status = models.CharField(max_length=20, choices=DeliveryStatus.choices, default=DeliveryStatus.ASSIGNED)
    last_latitude = models.DecimalField(max_digits=10, decimal_places=7, null=True, blank=True)
    last_longitude = models.DecimalField(max_digits=10, decimal_places=7, null=True, blank=True)
    last_accuracy_m = models.DecimalField(max_digits=8, decimal_places=2, null=True, blank=True)
    last_location_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        return f"Entrega #{self.pk} / Pedido #{self.order_id}"


class DeliveryLocation(models.Model):
    delivery = models.ForeignKey(Delivery, on_delete=models.CASCADE, related_name="locations")
    latitude = models.DecimalField(max_digits=10, decimal_places=7)
    longitude = models.DecimalField(max_digits=10, decimal_places=7)
    accuracy_m = models.DecimalField(max_digits=8, decimal_places=2, null=True, blank=True)
    recorded_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-recorded_at"]

    def __str__(self):
        return f"{self.latitude}, {self.longitude}"

# Create your models here.
