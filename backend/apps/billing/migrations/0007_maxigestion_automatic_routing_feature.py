from django.db import migrations


def update_maxigestion_features(apps, schema_editor):
    Plan = apps.get_model("billing", "Plan")
    plan = Plan.objects.filter(name="MaxiGestion").first()
    if plan is None:
        return

    features = list(plan.features or [])
    next_features = [
        "Ruteo automatico y replanificacion" if item == "Ruteo manual para organizar entregas" else item
        for item in features
    ]
    if "Ruteo automatico y replanificacion" not in next_features:
        next_features.append("Ruteo automatico y replanificacion")

    plan.features = next_features
    plan.save(update_fields=["features"])


class Migration(migrations.Migration):
    dependencies = [
        ("billing", "0006_single_maxigestion_trial_plan"),
    ]

    operations = [
        migrations.RunPython(update_maxigestion_features, migrations.RunPython.noop),
    ]
