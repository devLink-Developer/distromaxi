from django.conf import settings
from django.db import models


class SubscriptionStatus(models.TextChoices):
    TRIAL = "TRIAL", "Prueba"
    ACTIVE = "ACTIVE", "Activa"
    PAST_DUE = "PAST_DUE", "Vencida"
    SUSPENDED = "SUSPENDED", "Suspendida"


class DistributorOnboardingStatus(models.TextChoices):
    ACCOUNT_CREATED = "ACCOUNT_CREATED", "Cuenta creada"
    PLAN_SELECTED = "PLAN_SELECTED", "Plan seleccionado"
    CHECKOUT_PENDING = "CHECKOUT_PENDING", "Checkout pendiente"
    ACTIVE = "ACTIVE", "Activa"
    REVIEW_REQUIRED = "REVIEW_REQUIRED", "Revisar manualmente"
    FAILED = "FAILED", "Fallida"


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
    address = models.CharField(max_length=255, blank=True)
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


class DistributorOnboarding(models.Model):
    user = models.OneToOneField(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="distributor_onboarding",
    )
    plan = models.ForeignKey(
        "billing.Plan",
        on_delete=models.PROTECT,
        related_name="distributor_onboardings",
        null=True,
        blank=True,
    )
    business_name = models.CharField(max_length=180)
    tax_id = models.CharField(max_length=40, unique=True)
    contact_name = models.CharField(max_length=180)
    email = models.EmailField(db_index=True)
    phone = models.CharField(max_length=40)
    status = models.CharField(
        max_length=32,
        choices=DistributorOnboardingStatus.choices,
        default=DistributorOnboardingStatus.ACCOUNT_CREATED,
    )
    mercado_pago_subscription_id = models.CharField(max_length=120, blank=True)
    mercado_pago_status = models.CharField(max_length=60, blank=True)
    review_reason = models.TextField(blank=True)
    failure_reason = models.TextField(blank=True)
    checkout_started_at = models.DateTimeField(null=True, blank=True)
    activated_at = models.DateTimeField(null=True, blank=True)
    last_notification_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        return f"{self.business_name} ({self.get_status_display()})"

# Create your models here.
