from django.urls import path

from .views import (
    DashboardCustomersView,
    DashboardOperationsView,
    DashboardProductsView,
    DashboardSalesView,
    DashboardSummaryView,
)

urlpatterns = [
    path("summary", DashboardSummaryView.as_view(), name="dashboard-summary"),
    path("sales", DashboardSalesView.as_view(), name="dashboard-sales"),
    path("customers", DashboardCustomersView.as_view(), name="dashboard-customers"),
    path("products", DashboardProductsView.as_view(), name="dashboard-products"),
    path("operations", DashboardOperationsView.as_view(), name="dashboard-operations"),
]
