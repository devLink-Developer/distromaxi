from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("distributors", "0003_alter_distributor_address_distributoronboarding"),
    ]

    operations = [
        migrations.AddField(
            model_name="distributor",
            name="address_notes",
            field=models.TextField(blank=True),
        ),
        migrations.AddField(
            model_name="distributor",
            name="postal_code",
            field=models.CharField(blank=True, max_length=10),
        ),
    ]
