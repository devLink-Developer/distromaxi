from django.conf import settings
from django.db import models


class Commerce(models.Model):
    user = models.OneToOneField(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        related_name="commerce_profile",
        null=True,
        blank=True,
    )
    distributor = models.ForeignKey(
        "distributors.Distributor",
        on_delete=models.PROTECT,
        related_name="customers",
        null=True,
        blank=True,
    )
    trade_name = models.CharField(max_length=180)
    legal_name = models.CharField(max_length=180, blank=True)
    tax_id = models.CharField(max_length=40, blank=True)
    contact_name = models.CharField(max_length=180)
    email = models.EmailField(blank=True)
    phone = models.CharField(max_length=40)
    address = models.CharField(max_length=255)
    city = models.CharField(max_length=120, blank=True)
    province = models.CharField(max_length=120, blank=True)
    latitude = models.DecimalField(max_digits=10, decimal_places=7, null=True, blank=True)
    longitude = models.DecimalField(max_digits=10, decimal_places=7, null=True, blank=True)
    delivery_notes = models.TextField(blank=True)
    active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["trade_name"]
        unique_together = [("distributor", "tax_id")]

    def __str__(self):
        return self.trade_name

# Create your models here.
