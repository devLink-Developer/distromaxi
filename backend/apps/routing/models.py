from django.db import models


class RoutePlanStatus(models.TextChoices):
    DRAFT = "DRAFT", "Borrador"
    CONFIRMED = "CONFIRMED", "Confirmado"
    DISPATCHED = "DISPATCHED", "Despachado"
    COMPLETED = "COMPLETED", "Completado"
    CANCELLED = "CANCELLED", "Cancelado"


class RouteRunStatus(models.TextChoices):
    CONFIRMED = "CONFIRMED", "Confirmada"
    DISPATCHED = "DISPATCHED", "Despachada"
    COMPLETED = "COMPLETED", "Completada"
    CANCELLED = "CANCELLED", "Cancelada"


class RouteStopStatus(models.TextChoices):
    PENDING = "PENDING", "Pendiente"
    ARRIVED = "ARRIVED", "Arribada"
    DELIVERED = "DELIVERED", "Entregada"
    SKIPPED = "SKIPPED", "Omitida"


class RoutePlan(models.Model):
    distributor = models.ForeignKey("distributors.Distributor", on_delete=models.CASCADE, related_name="route_plans")
    dispatch_date = models.DateField()
    status = models.CharField(max_length=20, choices=RoutePlanStatus.choices, default=RoutePlanStatus.DRAFT)
    provider = models.CharField(max_length=40, default="ors")
    generated_by = models.ForeignKey(
        "users.User",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="generated_route_plans",
    )
    total_runs = models.PositiveIntegerField(default=0)
    total_orders = models.PositiveIntegerField(default=0)
    total_distance_km = models.DecimalField(max_digits=14, decimal_places=3, default=0)
    total_duration_min = models.DecimalField(max_digits=14, decimal_places=2, default=0)
    total_load_kg = models.DecimalField(max_digits=14, decimal_places=3, default=0)
    total_load_m3 = models.DecimalField(max_digits=14, decimal_places=6, default=0)
    unassigned_summary = models.JSONField(default=list, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-dispatch_date", "-created_at"]
        indexes = [
            models.Index(fields=["distributor", "dispatch_date"]),
            models.Index(fields=["distributor", "status"]),
        ]

    def __str__(self):
        return f"Ruta {self.dispatch_date} #{self.pk}"


class RouteRun(models.Model):
    route_plan = models.ForeignKey(RoutePlan, on_delete=models.CASCADE, related_name="runs")
    driver = models.ForeignKey("fleet.DriverProfile", on_delete=models.PROTECT, related_name="route_runs")
    vehicle = models.ForeignKey("fleet.Vehicle", on_delete=models.PROTECT, related_name="route_runs")
    sequence = models.PositiveIntegerField(default=1)
    status = models.CharField(max_length=20, choices=RouteRunStatus.choices, default=RouteRunStatus.CONFIRMED)
    total_stops = models.PositiveIntegerField(default=0)
    total_distance_km = models.DecimalField(max_digits=14, decimal_places=3, default=0)
    total_duration_min = models.DecimalField(max_digits=14, decimal_places=2, default=0)
    load_kg = models.DecimalField(max_digits=14, decimal_places=3, default=0)
    load_m3 = models.DecimalField(max_digits=14, decimal_places=6, default=0)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["sequence", "id"]
        unique_together = [("route_plan", "sequence")]

    def __str__(self):
        return f"Recorrido #{self.pk} - {self.driver}"


class RouteStop(models.Model):
    route_run = models.ForeignKey(RouteRun, on_delete=models.CASCADE, related_name="stops")
    order = models.ForeignKey("orders.Order", on_delete=models.PROTECT, related_name="route_stops")
    delivery = models.ForeignKey(
        "deliveries.Delivery",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="route_stops",
    )
    sequence = models.PositiveIntegerField()
    status = models.CharField(max_length=20, choices=RouteStopStatus.choices, default=RouteStopStatus.PENDING)
    planned_eta = models.DateTimeField()
    window_start_at = models.DateTimeField()
    window_end_at = models.DateTimeField()
    leg_distance_km = models.DecimalField(max_digits=14, decimal_places=3, default=0)
    leg_duration_min = models.DecimalField(max_digits=14, decimal_places=2, default=0)
    demand_kg = models.DecimalField(max_digits=14, decimal_places=3, default=0)
    demand_m3 = models.DecimalField(max_digits=14, decimal_places=6, default=0)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["sequence", "id"]
        unique_together = [("route_run", "sequence"), ("route_run", "order")]

    def __str__(self):
        return f"Parada #{self.sequence} / Pedido #{self.order_id}"
