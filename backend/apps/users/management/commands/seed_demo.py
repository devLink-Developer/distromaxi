from datetime import date, timedelta
from decimal import Decimal

from django.contrib.auth import get_user_model
from django.core.management.base import BaseCommand

from apps.billing.models import Plan, Subscription
from apps.commerces.models import Commerce
from apps.deliveries.models import Delivery
from apps.distributors.models import Distributor, DistributorDeliverySlot
from apps.fleet.models import DriverProfile, Vehicle
from apps.inventory.services import adjust_stock, ensure_default_warehouse
from apps.orders.models import Order, OrderItem
from apps.products.models import Product, ProductCategory, ProductSubCategory, ProductSupplier

User = get_user_model()

MAXIGESTION_PLAN_URL = "https://www.mercadopago.com.ar/subscriptions/checkout?preapproval_plan_id=0b5dbf4e218448818eaea55b9aa8e182"
MAXIGESTION_PLAN_ID = "0b5dbf4e218448818eaea55b9aa8e182"


class Command(BaseCommand):
    help = "Carga datos demo para probar DistroMaxi de punta a punta."

    def handle(self, *args, **options):
        admin = self._user("admin@distromax.local", "Admin Demo", "ADMIN", is_staff=True, is_superuser=True)
        distributor_user = self._user("ventas@andina.local", "Distribuidora Andina", "DISTRIBUTOR")
        commerce_user = self._user("compras@almacenluna.local", "Almacén Luna", "COMMERCE")
        driver_user = self._user("chofer@andina.local", "Marta Chofer", "DRIVER")

        distributor, _ = Distributor.objects.update_or_create(
            tax_id="30-71234567-9",
            defaults={
                "owner": distributor_user,
                "business_name": "Distribuidora Andina",
                "contact_name": "Sofía Rivas",
                "email": "ventas@andina.local",
                "phone": "+54 11 5555-0100",
                "postal_code": "1414",
                "address": "Av. San Martín 2450",
                "city": "Buenos Aires",
                "province": "CABA",
                "address_notes": "Ingresar por la darsena principal.",
                "latitude": Decimal("-34.6037220"),
                "longitude": Decimal("-58.3815920"),
                "subscription_status": "ACTIVE",
                "plan_name": "MaxiGestion",
                "mercado_pago_link": MAXIGESTION_PLAN_URL,
                "active": True,
            },
        )
        plan, created = Plan.objects.get_or_create(
            name="MaxiGestion",
            defaults={
                "price": Decimal("49900.00"),
                "description": "Operacion comercial y logistica con 60 dias de prueba gratis.",
                "currency": "ARS",
                "mp_subscription_url": MAXIGESTION_PLAN_URL,
                "mp_preapproval_plan_id": MAXIGESTION_PLAN_ID,
                "is_active": True,
                "trial_days": 60,
                "features": [
                    "60 dias de prueba totalmente gratis",
                    "Catalogo online proveedor-comprador",
                    "Dashboard comercial y operativo",
                    "Listas de precios y reportes exportables",
                    "Ruteo automatico y replanificacion",
                ],
                "sort_order": 10,
                "is_featured": True,
                "max_products": 5000,
                "max_drivers": 80,
            },
        )
        if not created and (not plan.mp_subscription_url or not plan.mp_preapproval_plan_id):
            plan.mp_subscription_url = plan.mp_subscription_url or MAXIGESTION_PLAN_URL
            plan.mp_preapproval_plan_id = plan.mp_preapproval_plan_id or MAXIGESTION_PLAN_ID
            plan.save(update_fields=["mp_subscription_url", "mp_preapproval_plan_id"])
        Subscription.objects.update_or_create(
            distributor=distributor,
            defaults={
                "plan": plan,
                "status": "ACTIVE",
                "mercado_pago_link": plan.mp_subscription_url,
                "starts_at": date.today(),
                "expires_at": date.today() + timedelta(days=60),
            },
        )

        commerce, _ = Commerce.objects.update_or_create(
            distributor=distributor,
            tax_id="27-22333444-5",
            defaults={
                "user": commerce_user,
                "trade_name": "Almacén Luna",
                "legal_name": "Luna Market SRL",
                "contact_name": "Clara Luna",
                "email": "compras@almacenluna.local",
                "phone": "+54 11 5555-0200",
                "postal_code": "1414",
                "address": "Humboldt 1400",
                "city": "Buenos Aires",
                "province": "CABA",
                "latitude": Decimal("-34.5841000"),
                "longitude": Decimal("-58.4351000"),
                "default_window_start": "08:00",
                "default_window_end": "14:00",
                "delivery_notes": "Recibir por entrada lateral de 8 a 14.",
                "active": True,
            },
        )
        morning_slot, _ = DistributorDeliverySlot.objects.update_or_create(
            distributor=distributor,
            name="Maniana",
            defaults={"start_time": "08:00", "end_time": "12:00", "sort_order": 1, "active": True},
        )
        DistributorDeliverySlot.objects.update_or_create(
            distributor=distributor,
            name="Tarde",
            defaults={"start_time": "13:00", "end_time": "17:00", "sort_order": 2, "active": True},
        )

        warehouse = ensure_default_warehouse(distributor)
        products = [
            ("SKU-AGUA-1500", "7790001000010", "Agua mineral 1.5L x 6", "Bebidas", "Andina", Decimal("3250.00"), 120),
            ("SKU-ACEITE-900", "7790001000027", "Aceite girasol 900ml x 12", "Almacén", "Sol Claro", Decimal("15400.00"), 48),
            ("SKU-YERBA-1KG", "7790001000034", "Yerba mate 1kg x 10", "Infusiones", "Monte Verde", Decimal("28200.00"), 60),
            ("SKU-GASEOSA-225", "7790001000041", "Gaseosa cola 2.25L x 8", "Bebidas", "Norte", Decimal("19800.00"), 80),
        ]
        supplier, _ = ProductSupplier.objects.get_or_create(distributor=distributor, name="Proveedor Demo")
        for sku, barcode, name, category, brand, price, qty in products:
            product_category, _ = ProductCategory.objects.get_or_create(distributor=distributor, name=category)
            product_subcategory, _ = ProductSubCategory.objects.get_or_create(
                distributor=distributor,
                category=product_category,
                name="Mayorista",
            )
            units_per_package = int(name.split(" x ")[-1]) if " x " in name and name.split(" x ")[-1].isdigit() else 1
            product, _ = Product.objects.update_or_create(
                distributor=distributor,
                sku=sku,
                defaults={
                    "supplier": supplier,
                    "product_category": product_category,
                    "product_subcategory": product_subcategory,
                    "barcode": barcode,
                    "name": name,
                    "description": f"Presentación mayorista de {name}.",
                    "brand": brand,
                    "category": product_category.name,
                    "subcategory": product_subcategory.name,
                    "unit": "bulto",
                    "package_size": name.split(" x ")[-1] if " x " in name else "",
                    "length": Decimal("40.000"),
                    "width": Decimal("30.000"),
                    "height": Decimal("25.000"),
                    "dimension_unit": "cm",
                    "weight": Decimal("8.000"),
                    "weight_unit": "kg",
                    "units_per_package": units_per_package,
                    "packages_per_pallet": 60,
                    "units_per_pallet": 60 * units_per_package,
                    "price": price,
                    "cost": (price * Decimal("0.72")).quantize(Decimal("0.01")),
                    "discount_percent": Decimal("0.00"),
                    "discount_name": "",
                    "characteristics": f"{brand}. Venta mayorista por bulto.",
                    "image_url": "https://images.unsplash.com/photo-1542838132-92c53300491e?auto=format&fit=crop&w=900&q=80",
                    "stock_minimum": Decimal("10.000"),
                    "active": True,
                },
            )
            adjust_stock(product, Decimal(str(qty)), note="Seed demo", warehouse=warehouse)

        vehicle, _ = Vehicle.objects.update_or_create(
            distributor=distributor,
            plate="AB123CD",
            defaults={
                "vehicle_type": "Utilitario",
                "brand": "Renault",
                "model": "Kangoo",
                "year": 2022,
                "capacity_kg": Decimal("750.00"),
                "capacity_m3": Decimal("9.500"),
                "status": "AVAILABLE",
                "insurance_expires_at": date.today() + timedelta(days=180),
                "inspection_expires_at": date.today() + timedelta(days=220),
                "active": True,
            },
        )
        driver, _ = DriverProfile.objects.update_or_create(
            user=driver_user,
            defaults={
                "distributor": distributor,
                "license_number": "B1234567",
                "license_category": "B1",
                "license_expires_at": date.today() + timedelta(days=365),
                "phone": "+54 11 5555-0300",
                "emergency_contact": "Guardia Andina +54 11 5555-0399",
                "assigned_vehicle": vehicle,
                "available": True,
                "active": True,
            },
        )
        product_map = {product.sku: product for product in Product.objects.filter(distributor=distributor)}
        delivered_order = self._demo_order(
            distributor=distributor,
            commerce=commerce,
            notes="Pedido demo dashboard 1",
            defaults={
                "total": Decimal("52600.00"),
                "status": "DELIVERED",
                "dispatch_date": date.today() - timedelta(days=1),
                "delivery_address": commerce.address,
                "delivery_latitude": commerce.latitude,
                "delivery_longitude": commerce.longitude,
                "delivery_slot": morning_slot,
                "delivery_window_start": morning_slot.start_time,
                "delivery_window_end": morning_slot.end_time,
            },
        )
        self._sync_demo_items(
            delivered_order,
            [
                (product_map["SKU-AGUA-1500"], Decimal("4.000")),
                (product_map["SKU-GASEOSA-225"], Decimal("2.000")),
            ],
        )
        Delivery.objects.update_or_create(
            order=delivered_order,
            defaults={"driver": driver, "vehicle": vehicle, "status": "DELIVERED"},
        )
        pending_order = self._demo_order(
            distributor=distributor,
            commerce=commerce,
            notes="Pedido demo dashboard 2",
            defaults={
                "total": Decimal("43600.00"),
                "status": "ACCEPTED",
                "dispatch_date": date.today() + timedelta(days=1),
                "delivery_address": commerce.address,
                "delivery_latitude": commerce.latitude,
                "delivery_longitude": commerce.longitude,
                "delivery_slot": morning_slot,
                "delivery_window_start": morning_slot.start_time,
                "delivery_window_end": morning_slot.end_time,
            },
        )
        self._sync_demo_items(
            pending_order,
            [
                (product_map["SKU-ACEITE-900"], Decimal("1.000")),
                (product_map["SKU-YERBA-1KG"], Decimal("1.000")),
            ],
        )

        self.stdout.write(self.style.SUCCESS("Datos demo cargados. Password demo: Demo1234!"))
        self.stdout.write(f"Admin: {admin.email}")
        self.stdout.write(f"Distribuidora: {distributor_user.email}")
        self.stdout.write(f"Comercio: {commerce_user.email}")
        self.stdout.write(f"Chofer: {driver_user.email}")
        self.stdout.write(f"Cliente demo: {commerce.trade_name}")

    def _user(self, email, full_name, role, is_staff=False, is_superuser=False):
        user, created = User.objects.get_or_create(
            email=email,
            defaults={
                "full_name": full_name,
                "role": role,
                "phone": "+54 11 5555-0000",
                "is_staff": is_staff,
                "is_superuser": is_superuser,
            },
        )
        user.full_name = full_name
        user.role = role
        user.phone = user.phone or "+54 11 5555-0000"
        user.is_active = True
        user.is_staff = is_staff
        user.is_superuser = is_superuser
        user.set_password("Demo1234!")
        user.save(update_fields=["full_name", "role", "phone", "is_active", "is_staff", "is_superuser", "password", "updated_at"])
        return user

    def _demo_order(self, *, distributor, commerce, notes, defaults):
        order = (
            Order.objects.filter(distributor=distributor, commerce=commerce, notes=notes)
            .order_by("id")
            .first()
        )
        if order is None:
            return Order.objects.create(distributor=distributor, commerce=commerce, notes=notes, **defaults)
        for field, value in defaults.items():
            setattr(order, field, value)
        order.save(update_fields=[*defaults.keys(), "updated_at"])
        return order

    def _sync_demo_items(self, order, lines):
        total = Decimal("0.00")
        for product, quantity in lines:
            item = order.items.filter(product=product).order_by("id").first()
            if item is None:
                item = self._item(order, product, quantity)
            else:
                self._update_item(item, product, quantity)
            total += Decimal(item.subtotal)
        order.total = total
        order.save(update_fields=["total", "updated_at"])

    def _item(self, order, product, quantity):
        return OrderItem.objects.create(
            order=order,
            product=product,
            product_name=product.name,
            sku=product.sku,
            quantity=quantity,
            price=product.price,
            subtotal=Decimal(product.price) * Decimal(quantity),
            weight_kg=self._weight_total_kg(product, quantity),
            volume_m3=self._volume_total_m3(product, quantity),
        )

    def _update_item(self, item, product, quantity):
        item.product = product
        item.product_name = product.name
        item.sku = product.sku
        item.quantity = quantity
        item.price = product.price
        item.subtotal = Decimal(product.price) * Decimal(quantity)
        item.weight_kg = self._weight_total_kg(product, quantity)
        item.volume_m3 = self._volume_total_m3(product, quantity)
        item.save(update_fields=["product", "product_name", "sku", "quantity", "price", "subtotal", "weight_kg", "volume_m3"])
        return item

    def _weight_total_kg(self, product, quantity):
        factor = Decimal("0.001") if product.weight_unit == "g" else Decimal("1")
        return (Decimal(product.weight) * factor * Decimal(quantity)).quantize(Decimal("0.001"))

    def _volume_total_m3(self, product, quantity):
        unit_factor = {
            "mm": Decimal("0.001"),
            "cm": Decimal("0.01"),
            "m": Decimal("1"),
        }[product.dimension_unit]
        length_m = Decimal(product.length) * unit_factor
        width_m = Decimal(product.width) * unit_factor
        height_m = Decimal(product.height) * unit_factor
        return (length_m * width_m * height_m * Decimal(quantity)).quantize(Decimal("0.000001"))
