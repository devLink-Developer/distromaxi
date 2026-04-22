"""
URL configuration for config project.

The `urlpatterns` list routes URLs to views. For more information please see:
    https://docs.djangoproject.com/en/5.2/topics/http/urls/
Examples:
Function views
    1. Add an import:  from my_app import views
    2. Add a URL to urlpatterns:  path('', views.home, name='home')
Class-based views
    1. Add an import:  from other_app.views import Home
    2. Add a URL to urlpatterns:  path('', Home.as_view(), name='home')
Including another URLconf
    1. Import the include() function: from django.urls import include, path
    2. Add a URL to urlpatterns:  path('blog/', include('blog.urls'))
"""
from django.conf import settings
from django.conf.urls.static import static
from django.contrib import admin
from django.urls import include, path
from rest_framework.routers import DefaultRouter
from rest_framework_simplejwt.views import TokenRefreshView

from apps.billing.views import PlanViewSet, SubscriptionViewSet
from apps.commerces.views import CommerceViewSet
from apps.deliveries.views import DeliveryViewSet
from apps.distributors.views import (
    DistributorOnboardingPlanSelectionView,
    DistributorOnboardingStateView,
    DistributorSignupView,
    DistributorViewSet,
    MercadoPagoSubscriptionWebhookView,
)
from apps.fleet.views import DriverProfileViewSet, VehicleViewSet
from apps.imports.views import ImportJobViewSet
from apps.inventory.views import StockItemViewSet, StockMovementViewSet, WarehouseViewSet
from apps.notifications.views import NotificationEventViewSet, PushSubscriptionViewSet
from apps.orders.views import OrderViewSet
from apps.products.views import ProductCategoryViewSet, ProductSubCategoryViewSet, ProductSupplierViewSet, ProductViewSet
from apps.routing.views import DriverCurrentRouteView, RoutePlanViewSet, RouteStopViewSet
from apps.users.views import AddressGeocodeView, AddressReverseGeocodeView, CustomTokenObtainPairView, MeView, PostalCodeLookupView, RegisterView, UserViewSet

router = DefaultRouter()
router.register('users', UserViewSet, basename='users')
router.register('distributors', DistributorViewSet, basename='distributors')
router.register('commerces', CommerceViewSet, basename='commerces')
router.register('products', ProductViewSet, basename='products')
router.register('product-suppliers', ProductSupplierViewSet, basename='product-suppliers')
router.register('product-categories', ProductCategoryViewSet, basename='product-categories')
router.register('product-subcategories', ProductSubCategoryViewSet, basename='product-subcategories')
router.register('warehouses', WarehouseViewSet, basename='warehouses')
router.register('stock', StockItemViewSet, basename='stock')
router.register('stock-movements', StockMovementViewSet, basename='stock-movements')
router.register('orders', OrderViewSet, basename='orders')
router.register('vehicles', VehicleViewSet, basename='vehicles')
router.register('drivers', DriverProfileViewSet, basename='drivers')
router.register('deliveries', DeliveryViewSet, basename='deliveries')
router.register('push-subscriptions', PushSubscriptionViewSet, basename='push-subscriptions')
router.register('notifications', NotificationEventViewSet, basename='notifications')
router.register('plans', PlanViewSet, basename='plans')
router.register('subscriptions', SubscriptionViewSet, basename='subscriptions')
router.register('imports', ImportJobViewSet, basename='imports')
router.register('route-plans', RoutePlanViewSet, basename='route-plans')
router.register('route-stops', RouteStopViewSet, basename='route-stops')

urlpatterns = [
    path('admin/', admin.site.urls),
    path('api/plans', PlanViewSet.as_view({'get': 'list'}), name='plans-list'),
    path('api/auth/register', RegisterView.as_view(), name='auth-register'),
    path('api/auth/register-distributor', DistributorSignupView.as_view(), name='auth-register-distributor'),
    path('api/auth/login', CustomTokenObtainPairView.as_view(), name='auth-login'),
    path('api/auth/refresh', TokenRefreshView.as_view(), name='auth-refresh'),
    path('api/auth/me', MeView.as_view(), name='auth-me'),
    path('api/address/postal-code', PostalCodeLookupView.as_view(), name='address-postal-code'),
    path('api/address/geocode', AddressGeocodeView.as_view(), name='address-geocode'),
    path('api/address/reverse-geocode', AddressReverseGeocodeView.as_view(), name='address-reverse-geocode'),
    path('api/distributor-onboarding', DistributorOnboardingStateView.as_view(), name='distributor-onboarding'),
    path('api/distributor-onboarding/select-plan', DistributorOnboardingPlanSelectionView.as_view(), name='distributor-onboarding-select-plan'),
    path('api/billing/mercadopago/webhook', MercadoPagoSubscriptionWebhookView.as_view(), name='billing-mercadopago-webhook'),
    path('api/dashboard/', include('apps.dashboard.urls')),
    path('api/routes/me/current/', DriverCurrentRouteView.as_view(), name='driver-current-route'),
    path('api/', include(router.urls)),
]

if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
