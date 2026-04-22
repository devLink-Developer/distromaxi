from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("commerces", "0004_commerce_default_window_end_and_more"),
    ]

    operations = [
        migrations.AddField(
            model_name="commerce",
            name="postal_code",
            field=models.CharField(blank=True, max_length=10),
        ),
    ]
