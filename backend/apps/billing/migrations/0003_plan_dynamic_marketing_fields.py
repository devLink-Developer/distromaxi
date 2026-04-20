from django.db import migrations, models


START_URL = "https://www.mercadopago.com.ar/subscriptions/checkout?preapproval_plan_id=c994bdf8e4bc4a7094e425f62c309b2b"
PRO_URL = "https://www.mercadopago.com.ar/subscriptions/checkout?preapproval_plan_id=0b5dbf4e218448818eaea55b9aa8e182"
IA_URL = "https://www.mercadopago.com.ar/subscriptions/checkout?preapproval_plan_id=0df6bbd2cee849618c7f17277c907a6d"


def seed_plans(apps, schema_editor):
    Plan = apps.get_model("billing", "Plan")
    Subscription = apps.get_model("billing", "Subscription")
    plan_rows = [
        (
            "START",
            {
                "price": "19900.00",
                "description": "Ideal para comenzar. Gestión básica de pedidos.",
                "mp_subscription_url": START_URL,
                "sort_order": 10,
                "is_featured": False,
                "is_active": True,
                "currency": "ARS",
                "max_products": 500,
                "max_drivers": 10,
            },
        ),
        (
            "PRO",
            {
                "price": "49900.00",
                "description": "Escala tu operación. Estadísticas avanzadas y mejor control.",
                "mp_subscription_url": PRO_URL,
                "sort_order": 20,
                "is_featured": True,
                "is_active": True,
                "currency": "ARS",
                "max_products": 5000,
                "max_drivers": 80,
            },
        ),
        (
            "IA",
            {
                "price": "89900.00",
                "description": "Automatización inteligente. Recomendaciones de venta y optimización de rutas.",
                "mp_subscription_url": IA_URL,
                "sort_order": 30,
                "is_featured": False,
                "is_active": True,
                "currency": "ARS",
                "max_products": 12000,
                "max_drivers": 200,
            },
        ),
    ]

    valid_names = [name for name, _ in plan_rows]
    pro = Plan.objects.filter(name="PRO").first()
    legacy = Plan.objects.exclude(name__in=valid_names).order_by("id").first()
    if legacy and pro is None:
        legacy.name = "PRO"
        for key, value in dict(plan_rows)["PRO"].items():
            setattr(legacy, key, value)
        legacy.save()
        pro = legacy

    for name, defaults in plan_rows:
        plan, created = Plan.objects.get_or_create(name=name, defaults=defaults)
        if not created and name == "PRO":
            changed = False
            for key, value in defaults.items():
                if key in {"description", "mp_subscription_url"} or getattr(plan, key) in {"", None, 0}:
                    setattr(plan, key, value)
                    changed = True
            if changed:
                plan.save()

    pro = Plan.objects.get(name="PRO")
    for old_plan in Plan.objects.exclude(name__in=valid_names):
        Subscription.objects.filter(plan=old_plan).update(plan=pro)
        old_plan.delete()


class Migration(migrations.Migration):
    dependencies = [
        ("billing", "0002_initial"),
    ]

    operations = [
        migrations.RenameField(
            model_name="plan",
            old_name="monthly_price",
            new_name="price",
        ),
        migrations.RenameField(
            model_name="plan",
            old_name="mercado_pago_link",
            new_name="mp_subscription_url",
        ),
        migrations.RenameField(
            model_name="plan",
            old_name="active",
            new_name="is_active",
        ),
        migrations.AddField(
            model_name="plan",
            name="description",
            field=models.TextField(blank=True, default=""),
            preserve_default=False,
        ),
        migrations.AddField(
            model_name="plan",
            name="sort_order",
            field=models.PositiveIntegerField(default=0),
        ),
        migrations.AddField(
            model_name="plan",
            name="is_featured",
            field=models.BooleanField(default=False),
        ),
        migrations.AlterField(
            model_name="plan",
            name="name",
            field=models.CharField(
                choices=[("START", "START"), ("PRO", "PRO"), ("IA", "IA")],
                max_length=20,
                unique=True,
            ),
        ),
        migrations.AlterModelOptions(
            name="plan",
            options={"ordering": ["sort_order", "price"]},
        ),
        migrations.RunPython(seed_plans, migrations.RunPython.noop),
    ]
