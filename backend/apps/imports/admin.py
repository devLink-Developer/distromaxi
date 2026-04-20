from django.contrib import admin

from .models import ImportJob


@admin.register(ImportJob)
class ImportJobAdmin(admin.ModelAdmin):
    list_display = ("entity_type", "distributor", "status", "processed_rows", "error_rows", "created_at")
    list_filter = ("entity_type", "status")
    search_fields = ("original_filename", "distributor__business_name")

# Register your models here.
