from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):
    dependencies = [
        ("distributors", "0005_distributordeliveryslot"),
        ("routing", "0003_alter_routerun_driver"),
    ]

    operations = [
        migrations.AddField(
            model_name="routeplan",
            name="delivery_slot",
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.SET_NULL,
                related_name="route_plans",
                to="distributors.distributordeliveryslot",
            ),
        ),
        migrations.AddField(
            model_name="routeplan",
            name="delivery_window_end",
            field=models.TimeField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name="routeplan",
            name="delivery_window_start",
            field=models.TimeField(blank=True, null=True),
        ),
        migrations.AddIndex(
            model_name="routeplan",
            index=models.Index(fields=["distributor", "dispatch_date", "delivery_slot"], name="routing_rou_distrib_b9579f_idx"),
        ),
    ]
