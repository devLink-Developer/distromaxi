from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("distributors", "0005_distributordeliveryslot"),
    ]

    operations = [
        migrations.AddField(
            model_name="distributor",
            name="service_area_mode",
            field=models.CharField(
                choices=[
                    ("NONE", "Sin alcance"),
                    ("COUNTRY", "Pais completo"),
                    ("POLYGON", "Poligono"),
                ],
                default="NONE",
                max_length=16,
            ),
        ),
        migrations.AddField(
            model_name="distributor",
            name="service_area_country",
            field=models.CharField(blank=True, max_length=2),
        ),
        migrations.AddField(
            model_name="distributor",
            name="service_area_polygon",
            field=models.JSONField(blank=True, null=True),
        ),
    ]
