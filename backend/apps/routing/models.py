from django.db import models
from django.utils import timezone


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


class IdempotencyStatus(models.TextChoices):
    IN_PROGRESS = "IN_PROGRESS", "En proceso"
    COMPLETED = "COMPLETED", "Completada"
    FAILED = "FAILED", "Fallida"


class RoutePlan(models.Model):
    distributor = models.ForeignKey("distributors.Distributor", on_delete=models.CASCADE, related_name="route_plans")
    route_number = models.CharField(max_length=30, unique=True, null=True, blank=True)
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
    route_geometry = models.JSONField(null=True, blank=True)
    routing_status = models.CharField(max_length=60, blank=True)
    preview_payload = models.JSONField(default=dict, blank=True)
    reviewed_at = models.DateTimeField(null=True, blank=True)
    reviewed_by = models.ForeignKey(
        "users.User",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="reviewed_route_plans",
    )
    planning_version = models.PositiveIntegerField(default=1)
    capacity_override_reason = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-dispatch_date", "-created_at"]
        indexes = [
            models.Index(fields=["distributor", "dispatch_date"]),
            models.Index(fields=["distributor", "status"]),
            models.Index(fields=["distributor", "dispatch_date", "status"]),
            models.Index(fields=["status", "dispatch_date"]),
        ]

    def __str__(self):
        return self.route_number or f"Ruta {self.dispatch_date} #{self.pk}"


class RouteRun(models.Model):
    route_plan = models.ForeignKey(RoutePlan, on_delete=models.CASCADE, related_name="runs")
    driver = models.ForeignKey(
        "fleet.DriverProfile",
        on_delete=models.PROTECT,
        related_name="route_runs",
        null=True,
        blank=True,
    )
    vehicle = models.ForeignKey("fleet.Vehicle", on_delete=models.PROTECT, related_name="route_runs")
    sequence = models.PositiveIntegerField(default=1)
    status = models.CharField(max_length=20, choices=RouteRunStatus.choices, default=RouteRunStatus.CONFIRMED)
    total_stops = models.PositiveIntegerField(default=0)
    total_distance_km = models.DecimalField(max_digits=14, decimal_places=3, default=0)
    total_duration_min = models.DecimalField(max_digits=14, decimal_places=2, default=0)
    load_kg = models.DecimalField(max_digits=14, decimal_places=3, default=0)
    load_m3 = models.DecimalField(max_digits=14, decimal_places=6, default=0)
    route_geometry = models.JSONField(null=True, blank=True)
    origin_snapshot = models.JSONField(default=dict, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["sequence", "id"]
        unique_together = [("route_plan", "sequence")]

    def __str__(self):
        return f"Recorrido #{self.pk} - {self.driver or self.vehicle}"


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
    address_snapshot = models.JSONField(default=dict, blank=True)
    latitude = models.DecimalField(max_digits=10, decimal_places=7, null=True, blank=True)
    longitude = models.DecimalField(max_digits=10, decimal_places=7, null=True, blank=True)
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


class RouteStopLine(models.Model):
    stop = models.ForeignKey(RouteStop, on_delete=models.CASCADE, related_name="lines")
    order_item = models.ForeignKey("orders.OrderItem", on_delete=models.PROTECT, related_name="route_stop_lines")
    product = models.ForeignKey("products.Product", on_delete=models.PROTECT, related_name="route_stop_lines")
    quantity = models.DecimalField(max_digits=12, decimal_places=3)
    uom = models.CharField(max_length=40, blank=True)
    weight_kg = models.DecimalField(max_digits=14, decimal_places=3, default=0)
    volume_m3 = models.DecimalField(max_digits=14, decimal_places=6, default=0)
    delivered_qty = models.DecimalField(max_digits=12, decimal_places=3, default=0)
    returned_qty = models.DecimalField(max_digits=12, decimal_places=3, default=0)
    difference_qty = models.DecimalField(max_digits=12, decimal_places=3, default=0)
    capacity_estimated = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["id"]
        indexes = [
            models.Index(fields=["order_item"]),
            models.Index(fields=["product"]),
        ]

    def __str__(self):
        return f"{self.quantity} x {self.product}"


class RouteOptimizationRun(models.Model):
    route_plan = models.ForeignKey(RoutePlan, on_delete=models.CASCADE, related_name="optimization_runs")
    algorithm = models.CharField(max_length=80, default="multi_driver_best_insertion_v1")
    input_payload = models.JSONField(default=dict, blank=True)
    output_payload = models.JSONField(default=dict, blank=True)
    accepted = models.BooleanField(default=False)
    actor = models.ForeignKey(
        "users.User",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="route_optimization_runs",
    )
    created_at = models.DateTimeField(default=timezone.now)

    class Meta:
        ordering = ["-created_at"]


class IdempotencyKey(models.Model):
    key = models.CharField(max_length=180, unique=True)
    request_hash = models.CharField(max_length=64)
    response_payload = models.JSONField(null=True, blank=True)
    status = models.CharField(max_length=20, choices=IdempotencyStatus.choices, default=IdempotencyStatus.IN_PROGRESS)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        return self.key


class RouteAuditEvent(models.Model):
    route_plan = models.ForeignKey(RoutePlan, on_delete=models.SET_NULL, null=True, blank=True, related_name="audit_events")
    event_type = models.CharField(max_length=80)
    payload = models.JSONField(default=dict, blank=True)
    actor = models.ForeignKey(
        "users.User",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="route_audit_events",
    )
    created_at = models.DateTimeField(default=timezone.now)

    class Meta:
        ordering = ["-created_at"]
        indexes = [models.Index(fields=["event_type", "created_at"])]
