from django.contrib import admin

from .models import FeedbackMessage, FeedbackThread


class FeedbackMessageInline(admin.TabularInline):
    model = FeedbackMessage
    extra = 0
    readonly_fields = ("author", "body", "is_staff_reply", "created_at")
    can_delete = False


@admin.register(FeedbackThread)
class FeedbackThreadAdmin(admin.ModelAdmin):
    list_display = ("subject", "created_by", "category", "status", "last_message_at", "created_at")
    list_filter = ("status", "category", "created_by__role")
    search_fields = ("subject", "created_by__email", "created_by__full_name", "messages__body")
    readonly_fields = ("created_by", "last_message_at", "created_at", "updated_at")
    inlines = [FeedbackMessageInline]


@admin.register(FeedbackMessage)
class FeedbackMessageAdmin(admin.ModelAdmin):
    list_display = ("thread", "author", "is_staff_reply", "created_at")
    list_filter = ("is_staff_reply", "author__role")
    search_fields = ("body", "thread__subject", "author__email", "author__full_name")
    readonly_fields = ("thread", "author", "body", "is_staff_reply", "created_at")
