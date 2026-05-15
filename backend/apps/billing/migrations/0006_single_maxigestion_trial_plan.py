from django.db import migrations, models


NEW_PLAN_NAME = "MaxiGestion"
PLUS_PRICE = "49900.00"
PLUS_URL = "https://www.mercadopago.com.ar/subscriptions/checkout?preapproval_plan_id=0b5dbf4e218448818eaea55b9aa8e182"
PLUS_PREAPPROVAL_ID = "0b5dbf4e218448818eaea55b9aa8e182"

PLAN_DEFAULTS = {
    "price": PLUS_PRICE,
    "description": "Operacion comercial y logistica para distribuidoras con 60 dias de prueba totalmente gratis.",
    "features": [
        "60 dias de prueba totalmente gratis",
        "Catalogo online proveedor-comprador",
        "Gestion de clientes, pedidos y stock",
        "Dashboard comercial y operativo",
        "Listas de precios, descuentos y reportes exportables",
        "Ruteo automatico y replanificacion",
        "Preparado para integraciones ERP",
    ],
    "currency": "ARS",
    "mp_subscription_url": PLUS_URL,
    "mp_preapproval_plan_id": PLUS_PREAPPROVAL_ID,
    "is_active": True,
    "sort_order": 10,
    "is_featured": True,
    "trial_days": 60,
    "max_products": 5000,
    "max_drivers": 80,
}


def configure_single_plan(apps, schema_editor):
    Plan = apps.get_model("billing", "Plan")
    Subscription = apps.get_model("billing", "Subscription")
    Distributor = apps.get_model("distributors", "Distributor")
    DistributorOnboarding = apps.get_model("distributors", "DistributorOnboarding")

    primary = Plan.objects.filter(name=NEW_PLAN_NAME).first()
    source = (
        Plan.objects.filter(name="Plus").first()
        or Plan.objects.filter(name="PRO").first()
        or Plan.objects.filter(is_featured=True).order_by("sort_order", "id").first()
        or Plan.objects.order_by("sort_order", "id").first()
    )

    if primary is None and source is not None:
        source.name = NEW_PLAN_NAME
        source.save(update_fields=["name"])
        primary = source

    if primary is None:
        primary = Plan.objects.create(name=NEW_PLAN_NAME, **PLAN_DEFAULTS)

    for field, value in PLAN_DEFAULTS.items():
        setattr(primary, field, value)
    primary.save()

    old_plans = Plan.objects.exclude(pk=primary.pk)
    Subscription.objects.filter(plan__in=old_plans).update(plan=primary)
    DistributorOnboarding.objects.filter(plan__in=old_plans).update(plan=primary)
    old_plans.delete()

    Distributor.objects.exclude(plan_name=NEW_PLAN_NAME).update(plan_name=NEW_PLAN_NAME)


class Migration(migrations.Migration):
    dependencies = [
        ("billing", "0005_standard_plus_pro_features"),
        ("distributors", "0004_distributor_address_notes_distributor_postal_code"),
    ]

    operations = [
        migrations.AddField(
            model_name="plan",
            name="trial_days",
            field=models.PositiveIntegerField(default=0),
        ),
        migrations.RunPython(configure_single_plan, migrations.RunPython.noop),
        migrations.AlterField(
            model_name="plan",
            name="name",
            field=models.CharField(
                choices=[("MaxiGestion", "MaxiGestion")],
                max_length=20,
                unique=True,
            ),
        ),
    ]
