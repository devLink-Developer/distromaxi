from django.conf import settings
from django.db import models


class VehicleStatus(models.TextChoices):
    AVAILABLE = "AVAILABLE", "Disponible"
    IN_ROUTE = "IN_ROUTE", "En ruta"
    MAINTENANCE = "MAINTENANCE", "Mantenimiento"
    INACTIVE = "INACTIVE", "Inactivo"


class Vehicle(models.Model):
    distributor = models.ForeignKey(
        "distributors.Distributor",
        on_delete=models.PROTECT,
        related_name="vehicles",
    )
    plate = models.CharField(max_length=20)
    vehicle_type = models.CharField(max_length=60)
    brand = models.CharField(max_length=80, blank=True)
    model = models.CharField(max_length=80, blank=True)
    year = models.PositiveIntegerField(null=True, blank=True)
    capacity_kg = models.DecimalField(max_digits=10, decimal_places=2, null=True, blank=True)
    capacity_m3 = models.DecimalField(max_digits=10, decimal_places=3, null=True, blank=True)
    status = models.CharField(max_length=20, choices=VehicleStatus.choices, default=VehicleStatus.AVAILABLE)
    insurance_expires_at = models.DateField(null=True, blank=True)
    inspection_expires_at = models.DateField(null=True, blank=True)
    active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["plate"]
        unique_together = [("distributor", "plate")]

    def __str__(self):
        return self.plate


class DriverProfile(models.Model):
    user = models.OneToOneField(settings.AUTH_USER_MODEL, on_delete=models.PROTECT, related_name="driver_profile")
    distributor = models.ForeignKey("distributors.Distributor", on_delete=models.PROTECT, related_name="drivers")
    license_number = models.CharField(max_length=80)
    license_category = models.CharField(max_length=40)
    license_expires_at = models.DateField(null=True, blank=True)
    phone = models.CharField(max_length=40)
    emergency_contact = models.CharField(max_length=180, blank=True)
    assigned_vehicle = models.ForeignKey(
        Vehicle,
        on_delete=models.SET_NULL,
        related_name="assigned_drivers",
        null=True,
        blank=True,
    )
    available = models.BooleanField(default=True)
    active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["user__full_name"]

    def __str__(self):
        return self.user.get_full_name()

# Create your models here.
