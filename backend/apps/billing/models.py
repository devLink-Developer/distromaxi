from django.db import models


class Plan(models.Model):
    class PlanName(models.TextChoices):
        START = "START", "START"
        PRO = "PRO", "PRO"
        IA = "IA", "IA"

    name = models.CharField(max_length=20, choices=PlanName.choices, unique=True)
    price = models.DecimalField(max_digits=12, decimal_places=2)
    description = models.TextField(blank=True)
    currency = models.CharField(max_length=3, default="ARS")
    mp_subscription_url = models.URLField(blank=True)
    is_active = models.BooleanField(default=True)
    sort_order = models.PositiveIntegerField(default=0)
    is_featured = models.BooleanField(default=False)
    max_products = models.PositiveIntegerField(default=500)
    max_drivers = models.PositiveIntegerField(default=20)

    class Meta:
        ordering = ["sort_order", "price"]

    def __str__(self):
        return self.name


class Subscription(models.Model):
    STATUS_CHOICES = [
        ("TRIAL", "Prueba"),
        ("ACTIVE", "Activa"),
        ("PAST_DUE", "Vencida"),
        ("SUSPENDED", "Suspendida"),
    ]
    distributor = models.OneToOneField(
        "distributors.Distributor",
        on_delete=models.CASCADE,
        related_name="subscription",
    )
    plan = models.ForeignKey(Plan, on_delete=models.PROTECT, related_name="subscriptions")
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default="TRIAL")
    mercado_pago_link = models.URLField(blank=True)
    starts_at = models.DateField(null=True, blank=True)
    expires_at = models.DateField(null=True, blank=True)
    notes = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["distributor__business_name"]

    def __str__(self):
        return f"{self.distributor} - {self.plan}"

# Create your models here.
