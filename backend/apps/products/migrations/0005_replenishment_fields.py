from decimal import Decimal

from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("products", "0004_product_characteristics_product_discount_name_and_more"),
    ]

    operations = [
        migrations.AddField(
            model_name="productsupplier",
            name="lead_time_days",
            field=models.PositiveIntegerField(default=0),
        ),
        migrations.AddField(
            model_name="product",
            name="stock_target",
            field=models.DecimalField(decimal_places=3, default=Decimal("0"), max_digits=12),
        ),
        migrations.AddField(
            model_name="product",
            name="replenishment_multiple",
            field=models.DecimalField(decimal_places=3, default=Decimal("0"), max_digits=12),
        ),
    ]
