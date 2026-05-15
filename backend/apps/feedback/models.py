from django.conf import settings
from django.db import models


class FeedbackThread(models.Model):
    class Status(models.TextChoices):
        OPEN = "OPEN", "Abierto"
        ANSWERED = "ANSWERED", "Respondido"
        CLOSED = "CLOSED", "Cerrado"

    class Category(models.TextChoices):
        SUGGESTION = "SUGGESTION", "Sugerencia"
        ISSUE = "ISSUE", "Problema"
        QUESTION = "QUESTION", "Consulta"
        OTHER = "OTHER", "Otro"

    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="feedback_threads",
    )
    subject = models.CharField(max_length=160)
    category = models.CharField(max_length=20, choices=Category.choices, default=Category.SUGGESTION)
    status = models.CharField(max_length=20, choices=Status.choices, default=Status.OPEN)
    last_message_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-last_message_at", "-created_at"]
        indexes = [
            models.Index(fields=["created_by", "status"]),
            models.Index(fields=["status", "last_message_at"]),
        ]

    def __str__(self):
        return f"{self.subject} ({self.status})"


class FeedbackMessage(models.Model):
    thread = models.ForeignKey(FeedbackThread, on_delete=models.CASCADE, related_name="messages")
    author = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="feedback_messages")
    body = models.TextField()
    is_staff_reply = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["created_at", "id"]

    def __str__(self):
        return f"Mensaje #{self.pk} en {self.thread_id}"
