from django.conf import settings
from django.db import models


class SubscriptionStatus(models.TextChoices):
    TRIAL = "TRIAL", "Prueba"
    ACTIVE = "ACTIVE", "Activa"
    PAST_DUE = "PAST_DUE", "Vencida"
    SUSPENDED = "SUSPENDED", "Suspendida"


class Distributor(models.Model):
    owner = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        related_name="owned_distributors",
    )
    business_name = models.CharField(max_length=180)
    tax_id = models.CharField(max_length=40, unique=True)
    contact_name = models.CharField(max_length=180)
    email = models.EmailField()
    phone = models.CharField(max_length=40)
    address = models.CharField(max_length=255)
    city = models.CharField(max_length=120, blank=True)
    province = models.CharField(max_length=120, blank=True)
    latitude = models.DecimalField(max_digits=10, decimal_places=7, null=True, blank=True)
    longitude = models.DecimalField(max_digits=10, decimal_places=7, null=True, blank=True)
    currency = models.CharField(max_length=3, default="ARS")
    plan_name = models.CharField(max_length=80, default="Mayorista")
    subscription_status = models.CharField(
        max_length=20,
        choices=SubscriptionStatus.choices,
        default=SubscriptionStatus.TRIAL,
    )
    mercado_pago_link = models.URLField(blank=True)
    active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["business_name"]

    def __str__(self):
        return self.business_name

    @property
    def can_operate(self):
        return self.active and self.subscription_status in {
            SubscriptionStatus.TRIAL,
            SubscriptionStatus.ACTIVE,
        }

# Create your models here.
