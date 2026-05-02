from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):
    dependencies = [
        ("distributors", "0005_distributordeliveryslot"),
        ("orders", "0005_order_delivery_window_end_and_more"),
    ]

    operations = [
        migrations.AddField(
            model_name="order",
            name="delivery_slot",
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.SET_NULL,
                related_name="orders",
                to="distributors.distributordeliveryslot",
            ),
        ),
        migrations.AlterField(
            model_name="order",
            name="status",
            field=models.CharField(
                choices=[
                    ("PENDING", "Pendiente"),
                    ("ACCEPTED", "Aceptado"),
                    ("REJECTED", "Rechazado"),
                    ("PREPARING", "Preparando"),
                    ("SCHEDULED", "Programado"),
                    ("ON_THE_WAY", "En camino"),
                    ("DELIVERED", "Entregado"),
                    ("CANCELLED", "Cancelado"),
                ],
                default="PENDING",
                max_length=20,
            ),
        ),
        migrations.AddIndex(
            model_name="order",
            index=models.Index(fields=["distributor", "dispatch_date", "delivery_slot"], name="orders_orde_distrib_6d0ea9_idx"),
        ),
    ]
