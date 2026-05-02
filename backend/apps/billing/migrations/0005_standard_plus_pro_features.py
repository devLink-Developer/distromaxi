from django.db import migrations, models


PLAN_DEFAULTS = {
    "Standard": {
        "description": "Conexion proveedor-comprador para vender con catalogo, pedidos, stock basico y ruteo manual.",
        "features": [
            "Catalogo online proveedor-comprador",
            "Gestion de clientes, pedidos y stock basico",
            "Importacion y exportacion CSV/XLS",
            "Notificaciones internas",
            "Ruteo manual",
        ],
        "sort_order": 10,
        "is_featured": False,
        "is_active": True,
        "max_products": 500,
        "max_drivers": 10,
    },
    "Plus": {
        "description": "Operacion avanzada con dashboards, alertas, listas de precios y preparacion para integraciones ERP.",
        "features": [
            "Todo Standard",
            "Dashboard comercial y operativo",
            "Alertas de stock",
            "Listas de precios y descuentos",
            "Reportes exportables",
            "Preparacion para integraciones ERP",
        ],
        "sort_order": 20,
        "is_featured": True,
        "is_active": True,
        "max_products": 5000,
        "max_drivers": 80,
    },
    "Pro": {
        "description": "Automatizacion logistica y comercial con ruteo automatico, optimizacion multi-vehiculo e integraciones avanzadas.",
        "features": [
            "Todo Plus",
            "Ruteo automatico y replanificacion",
            "Optimizacion multi-vehiculo",
            "Metricas logisticas avanzadas",
            "Automatizaciones",
            "Integraciones avanzadas y ARCA/facturacion como add-on",
        ],
        "sort_order": 30,
        "is_featured": False,
        "is_active": True,
        "max_products": 12000,
        "max_drivers": 200,
    },
}


LEGACY_MAPPING = {
    "START": "Standard",
    "PRO": "Plus",
    "IA": "Pro",
}


def migrate_plan_names(apps, schema_editor):
    Plan = apps.get_model("billing", "Plan")
    Subscription = apps.get_model("billing", "Subscription")
    Distributor = apps.get_model("distributors", "Distributor")
    DistributorOnboarding = apps.get_model("distributors", "DistributorOnboarding")

    for legacy_name, next_name in LEGACY_MAPPING.items():
        legacy = Plan.objects.filter(name=legacy_name).first()
        existing = Plan.objects.filter(name=next_name).first()
        if not legacy:
            continue
        if existing:
            Subscription.objects.filter(plan=legacy).update(plan=existing)
            DistributorOnboarding.objects.filter(plan=legacy).update(plan=existing)
            legacy.delete()
        else:
            legacy.name = next_name
            legacy.save(update_fields=["name"])

    for name, defaults in PLAN_DEFAULTS.items():
        plan, _ = Plan.objects.get_or_create(
            name=name,
            defaults={
                "price": {"Standard": "19900.00", "Plus": "49900.00", "Pro": "89900.00"}[name],
                "currency": "ARS",
                **defaults,
            },
        )
        changed_fields = []
        for field, value in defaults.items():
            if getattr(plan, field, None) != value:
                setattr(plan, field, value)
                changed_fields.append(field)
        if changed_fields:
            plan.save(update_fields=[*changed_fields, "updated_at"] if hasattr(plan, "updated_at") else changed_fields)

    for legacy_name, next_name in LEGACY_MAPPING.items():
        Distributor.objects.filter(plan_name=legacy_name).update(plan_name=next_name)


def restore_legacy_plan_names(apps, schema_editor):
    Plan = apps.get_model("billing", "Plan")
    Distributor = apps.get_model("distributors", "Distributor")
    reverse_mapping = {value: key for key, value in LEGACY_MAPPING.items()}
    for current_name, legacy_name in reverse_mapping.items():
        Plan.objects.filter(name=current_name).update(name=legacy_name)
        Distributor.objects.filter(plan_name=current_name).update(plan_name=legacy_name)


class Migration(migrations.Migration):
    dependencies = [
        ("billing", "0004_plan_mp_preapproval_plan_id_and_more"),
        ("distributors", "0004_distributor_address_notes_distributor_postal_code"),
    ]

    operations = [
        migrations.AddField(
            model_name="plan",
            name="features",
            field=models.JSONField(blank=True, default=list),
        ),
        migrations.RunPython(migrate_plan_names, restore_legacy_plan_names),
        migrations.AlterField(
            model_name="plan",
            name="name",
            field=models.CharField(
                choices=[("Standard", "Standard"), ("Plus", "Plus"), ("Pro", "Pro")],
                max_length=20,
                unique=True,
            ),
        ),
    ]
