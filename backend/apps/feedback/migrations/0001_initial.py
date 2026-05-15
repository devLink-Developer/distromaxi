import django.db.models.deletion
from django.conf import settings
from django.db import migrations, models


class Migration(migrations.Migration):
    initial = True

    dependencies = [
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.CreateModel(
            name="FeedbackThread",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("subject", models.CharField(max_length=160)),
                (
                    "category",
                    models.CharField(
                        choices=[
                            ("SUGGESTION", "Sugerencia"),
                            ("ISSUE", "Problema"),
                            ("QUESTION", "Consulta"),
                            ("OTHER", "Otro"),
                        ],
                        default="SUGGESTION",
                        max_length=20,
                    ),
                ),
                (
                    "status",
                    models.CharField(
                        choices=[("OPEN", "Abierto"), ("ANSWERED", "Respondido"), ("CLOSED", "Cerrado")],
                        default="OPEN",
                        max_length=20,
                    ),
                ),
                ("last_message_at", models.DateTimeField(blank=True, null=True)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                (
                    "created_by",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="feedback_threads",
                        to=settings.AUTH_USER_MODEL,
                    ),
                ),
            ],
            options={
                "ordering": ["-last_message_at", "-created_at"],
            },
        ),
        migrations.CreateModel(
            name="FeedbackMessage",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("body", models.TextField()),
                ("is_staff_reply", models.BooleanField(default=False)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                (
                    "author",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="feedback_messages",
                        to=settings.AUTH_USER_MODEL,
                    ),
                ),
                (
                    "thread",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="messages",
                        to="feedback.feedbackthread",
                    ),
                ),
            ],
            options={
                "ordering": ["created_at", "id"],
            },
        ),
        migrations.AddIndex(
            model_name="feedbackthread",
            index=models.Index(fields=["created_by", "status"], name="feedback_fe_created_59bb95_idx"),
        ),
        migrations.AddIndex(
            model_name="feedbackthread",
            index=models.Index(fields=["status", "last_message_at"], name="feedback_fe_status_184d43_idx"),
        ),
    ]
