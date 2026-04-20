from django.conf import settings
from django.db import models


class PushSubscription(models.Model):
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="push_subscriptions")
    endpoint = models.TextField(unique=True)
    p256dh = models.TextField()
    auth = models.TextField()
    user_agent = models.CharField(max_length=255, blank=True)
    active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-updated_at"]

    def __str__(self):
        return f"{self.user.email} push"


class NotificationKind(models.TextChoices):
    ORDER = "ORDER", "Pedido"
    DELIVERY = "DELIVERY", "Entrega"
    STOCK = "STOCK", "Stock"
    BILLING = "BILLING", "Suscripción"
    SYSTEM = "SYSTEM", "Sistema"


class NotificationEvent(models.Model):
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="notifications",
        null=True,
        blank=True,
    )
    distributor = models.ForeignKey(
        "distributors.Distributor",
        on_delete=models.CASCADE,
        related_name="notifications",
        null=True,
        blank=True,
    )
    kind = models.CharField(max_length=20, choices=NotificationKind.choices, default=NotificationKind.SYSTEM)
    title = models.CharField(max_length=120)
    body = models.CharField(max_length=255)
    payload = models.JSONField(default=dict, blank=True)
    read_at = models.DateTimeField(null=True, blank=True)
    delivery_status = models.CharField(max_length=40, default="PENDING")
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        return self.title

# Create your models here.
