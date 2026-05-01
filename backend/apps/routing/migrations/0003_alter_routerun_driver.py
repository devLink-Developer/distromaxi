from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ("fleet", "0003_vehicle_capacity_m3"),
        ("routing", "0002_idempotencykey_routeauditevent_routeoptimizationrun_and_more"),
    ]

    operations = [
        migrations.AlterField(
            model_name="routerun",
            name="driver",
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.PROTECT,
                related_name="route_runs",
                to="fleet.driverprofile",
            ),
        ),
    ]
