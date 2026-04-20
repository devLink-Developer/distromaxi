from django.conf import settings
from django.db import models


class ImportEntity(models.TextChoices):
    PRODUCTS = "products", "Productos"
    CUSTOMERS = "customers", "Clientes"
    VEHICLES = "vehicles", "Vehículos"
    DRIVERS = "drivers", "Choferes"
    STOCK = "stock", "Stock"


class ImportStatus(models.TextChoices):
    PENDING = "PENDING", "Pendiente"
    PROCESSING = "PROCESSING", "Procesando"
    COMPLETED = "COMPLETED", "Completado"
    FAILED = "FAILED", "Fallido"


class ImportJob(models.Model):
    distributor = models.ForeignKey(
        "distributors.Distributor",
        on_delete=models.PROTECT,
        related_name="import_jobs",
        null=True,
        blank=True,
    )
    created_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.PROTECT, related_name="import_jobs")
    entity_type = models.CharField(max_length=40, choices=ImportEntity.choices)
    original_filename = models.CharField(max_length=255, blank=True)
    status = models.CharField(max_length=20, choices=ImportStatus.choices, default=ImportStatus.PENDING)
    total_rows = models.PositiveIntegerField(default=0)
    processed_rows = models.PositiveIntegerField(default=0)
    error_rows = models.PositiveIntegerField(default=0)
    errors = models.JSONField(default=list, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        return f"{self.entity_type} import #{self.pk}"

# Create your models here.
