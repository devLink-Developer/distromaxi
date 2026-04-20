import csv
import io

from django.contrib.auth import get_user_model
from django.http import HttpResponse
from rest_framework import decorators, permissions, response, status, viewsets

from apps.commerces.models import Commerce
from apps.distributors.utils import filter_by_distributor, get_user_distributor
from apps.fleet.models import DriverProfile, Vehicle
from apps.inventory.services import adjust_stock, ensure_default_warehouse
from apps.products.models import Product, ProductCategory, ProductSubCategory, ProductSupplier

from .models import ImportEntity, ImportJob, ImportStatus
from .serializers import ImportJobSerializer

User = get_user_model()

TEMPLATES = {
    ImportEntity.PRODUCTS: [
        "sku",
        "barcode",
        "name",
        "description",
        "brand",
        "supplier",
        "category",
        "subcategory",
        "unit",
        "package_size",
        "length",
        "width",
        "height",
        "dimension_unit",
        "weight",
        "weight_unit",
        "units_per_package",
        "packages_per_pallet",
        "units_per_pallet",
        "price",
        "cost",
        "costo",
        "discount_percent",
        "porc_descuento",
        "discount_name",
        "nombre_descuento",
        "characteristics",
        "caracteristicas",
        "image_url",
        "stock_minimum",
    ],
    ImportEntity.CUSTOMERS: [
        "trade_name",
        "legal_name",
        "tax_id",
        "contact_name",
        "email",
        "phone",
        "address",
        "city",
        "province",
        "latitude",
        "longitude",
        "delivery_notes",
    ],
    ImportEntity.VEHICLES: [
        "plate",
        "vehicle_type",
        "brand",
        "model",
        "year",
        "capacity_kg",
        "insurance_expires_at",
        "inspection_expires_at",
    ],
    ImportEntity.DRIVERS: [
        "email",
        "full_name",
        "phone",
        "license_number",
        "license_category",
        "license_expires_at",
        "emergency_contact",
        "vehicle_plate",
    ],
    ImportEntity.STOCK: ["sku", "quantity", "note"],
}


class ImportJobViewSet(viewsets.ReadOnlyModelViewSet):
    serializer_class = ImportJobSerializer

    def get_permissions(self):
        if self.action == "template":
            return [permissions.AllowAny()]
        return [permissions.IsAuthenticated()]

    def get_queryset(self):
        queryset = ImportJob.objects.select_related("distributor", "created_by")
        return filter_by_distributor(queryset, self.request.user)

    @decorators.action(detail=False, methods=["get"], url_path=r"template/(?P<entity>[^/.]+)")
    def template(self, request, entity=None):
        if entity not in TEMPLATES:
            return response.Response({"detail": "Entidad inválida."}, status=status.HTTP_400_BAD_REQUEST)
        content = io.StringIO()
        writer = csv.writer(content)
        writer.writerow(TEMPLATES[entity])
        http_response = HttpResponse(content.getvalue(), content_type="text/csv; charset=utf-8")
        http_response["Content-Disposition"] = f'attachment; filename="{entity}_template.csv"'
        return http_response

    @decorators.action(detail=False, methods=["post"], url_path="upload")
    def upload(self, request):
        entity_type = request.data.get("entity_type")
        uploaded = request.FILES.get("file")
        distributor = get_user_distributor(request.user)
        if entity_type not in TEMPLATES:
            return response.Response({"detail": "entity_type inválido."}, status=status.HTTP_400_BAD_REQUEST)
        if uploaded is None:
            return response.Response({"detail": "Archivo CSV requerido en file."}, status=status.HTTP_400_BAD_REQUEST)
        if distributor is None and request.user.role != "ADMIN":
            return response.Response({"detail": "El usuario no tiene distribuidora asociada."}, status=status.HTTP_400_BAD_REQUEST)

        job = ImportJob.objects.create(
            distributor=distributor,
            created_by=request.user,
            entity_type=entity_type,
            original_filename=uploaded.name,
            status=ImportStatus.PROCESSING,
        )
        errors = []
        processed = 0
        text_stream = io.TextIOWrapper(uploaded.file, encoding="utf-8-sig")
        rows = list(csv.DictReader(text_stream))
        for index, row in enumerate(rows, start=2):
            try:
                self._process_row(entity_type, distributor, row)
                processed += 1
            except Exception as exc:
                errors.append({"row": index, "error": str(exc), "data": row})

        job.total_rows = len(rows)
        job.processed_rows = processed
        job.error_rows = len(errors)
        job.errors = errors
        job.status = ImportStatus.COMPLETED if not errors else ImportStatus.FAILED
        job.save()
        return response.Response(self.get_serializer(job).data, status=status.HTTP_201_CREATED)

    def _process_row(self, entity_type, distributor, row):
        if entity_type == ImportEntity.PRODUCTS:
            supplier_name = row.get("supplier", "").strip()
            category_name = row.get("category", "General").strip() or "General"
            subcategory_name = row.get("subcategory", "").strip()
            supplier = None
            if supplier_name:
                supplier, _ = ProductSupplier.objects.get_or_create(distributor=distributor, name=supplier_name)
            category, _ = ProductCategory.objects.get_or_create(distributor=distributor, name=category_name)
            subcategory = None
            if subcategory_name:
                subcategory, _ = ProductSubCategory.objects.get_or_create(
                    distributor=distributor,
                    category=category,
                    name=subcategory_name,
                )
            Product.objects.update_or_create(
                distributor=distributor,
                sku=row["sku"],
                defaults={
                    "supplier": supplier,
                    "product_category": category,
                    "product_subcategory": subcategory,
                    "barcode": row.get("barcode", ""),
                    "name": row["name"],
                    "description": row.get("description", ""),
                    "brand": row.get("brand", ""),
                    "category": category.name,
                    "subcategory": subcategory.name if subcategory else "",
                    "unit": row.get("unit", "unidad"),
                    "package_size": row.get("package_size", ""),
                    "length": row.get("length") or 0,
                    "width": row.get("width") or 0,
                    "height": row.get("height") or 0,
                    "dimension_unit": row.get("dimension_unit") or "cm",
                    "weight": row.get("weight") or 0,
                    "weight_unit": row.get("weight_unit") or "kg",
                    "units_per_package": row.get("units_per_package") or 1,
                    "packages_per_pallet": row.get("packages_per_pallet") or None,
                    "units_per_pallet": row.get("units_per_pallet") or None,
                    "price": row["price"],
                    "cost": row.get("cost") or row.get("costo") or 0,
                    "discount_percent": row.get("discount_percent") or row.get("porc_descuento") or 0,
                    "discount_name": row.get("discount_name") or row.get("nombre_descuento") or "",
                    "characteristics": row.get("characteristics") or row.get("caracteristicas") or "",
                    "image_url": row.get("image_url", ""),
                    "stock_minimum": row.get("stock_minimum") or 0,
                    "active": True,
                },
            )
        elif entity_type == ImportEntity.CUSTOMERS:
            Commerce.objects.update_or_create(
                distributor=distributor,
                tax_id=row.get("tax_id", ""),
                defaults={
                    "trade_name": row["trade_name"],
                    "legal_name": row.get("legal_name", ""),
                    "contact_name": row.get("contact_name", row["trade_name"]),
                    "email": row.get("email", ""),
                    "phone": row.get("phone", ""),
                    "address": row.get("address", ""),
                    "city": row.get("city", ""),
                    "province": row.get("province", ""),
                    "latitude": row.get("latitude") or None,
                    "longitude": row.get("longitude") or None,
                    "delivery_notes": row.get("delivery_notes", ""),
                    "active": True,
                },
            )
        elif entity_type == ImportEntity.VEHICLES:
            Vehicle.objects.update_or_create(
                distributor=distributor,
                plate=row["plate"],
                defaults={
                    "vehicle_type": row.get("vehicle_type", "Utilitario"),
                    "brand": row.get("brand", ""),
                    "model": row.get("model", ""),
                    "year": row.get("year") or None,
                    "capacity_kg": row.get("capacity_kg") or None,
                    "insurance_expires_at": row.get("insurance_expires_at") or None,
                    "inspection_expires_at": row.get("inspection_expires_at") or None,
                    "active": True,
                },
            )
        elif entity_type == ImportEntity.DRIVERS:
            user, created = User.objects.get_or_create(
                email=row["email"],
                defaults={"full_name": row["full_name"], "role": "DRIVER", "phone": row.get("phone", "")},
            )
            if created:
                user.set_password("Cambiar1234")
                user.save(update_fields=["password"])
            vehicle = None
            if row.get("vehicle_plate"):
                vehicle = Vehicle.objects.filter(distributor=distributor, plate=row["vehicle_plate"]).first()
            DriverProfile.objects.update_or_create(
                user=user,
                defaults={
                    "distributor": distributor,
                    "license_number": row["license_number"],
                    "license_category": row.get("license_category", "B1"),
                    "license_expires_at": row.get("license_expires_at") or None,
                    "phone": row.get("phone", ""),
                    "emergency_contact": row.get("emergency_contact", ""),
                    "assigned_vehicle": vehicle,
                    "available": True,
                    "active": True,
                },
            )
        elif entity_type == ImportEntity.STOCK:
            product = Product.objects.get(distributor=distributor, sku=row["sku"])
            ensure_default_warehouse(distributor)
            adjust_stock(product, row["quantity"], note=row.get("note", "Importación CSV"))

# Create your views here.
