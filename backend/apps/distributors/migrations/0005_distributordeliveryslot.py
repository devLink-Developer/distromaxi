from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):
    dependencies = [
        ("distributors", "0004_distributor_address_notes_distributor_postal_code"),
    ]

    operations = [
        migrations.CreateModel(
            name="DistributorDeliverySlot",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("name", models.CharField(max_length=80)),
                ("start_time", models.TimeField()),
                ("end_time", models.TimeField()),
                ("active", models.BooleanField(default=True)),
                ("sort_order", models.PositiveIntegerField(default=0)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                (
                    "distributor",
                    models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="delivery_slots", to="distributors.distributor"),
                ),
            ],
            options={
                "ordering": ["sort_order", "start_time", "id"],
                "unique_together": {("distributor", "name")},
            },
        ),
        migrations.AddIndex(
            model_name="distributordeliveryslot",
            index=models.Index(fields=["distributor", "active", "sort_order"], name="distributor_distrib_1bf2b4_idx"),
        ),
    ]
