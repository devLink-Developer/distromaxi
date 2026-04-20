from rest_framework import serializers

from .models import ImportJob


class ImportJobSerializer(serializers.ModelSerializer):
    distributor_name = serializers.CharField(source="distributor.business_name", read_only=True)

    class Meta:
        model = ImportJob
        fields = [
            "id",
            "distributor",
            "distributor_name",
            "created_by",
            "entity_type",
            "original_filename",
            "status",
            "total_rows",
            "processed_rows",
            "error_rows",
            "errors",
            "created_at",
            "updated_at",
        ]
        read_only_fields = [
            "id",
            "created_by",
            "status",
            "total_rows",
            "processed_rows",
            "error_rows",
            "errors",
            "created_at",
            "updated_at",
        ]
