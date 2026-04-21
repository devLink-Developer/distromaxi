import { useEffect } from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'

import { AppLayout } from '../components/AppLayout'
import {
  AdminDistributorsPage,
  AdminSubscriptionsPage,
  AdminUsersPage,
  BillingPage,
  CustomersManagerPage,
  DashboardOrdersPage,
  DashboardPage,
  DistributorProfilePage,
  DriversManagerPage,
  ImportsPage,
  ProductsManagerPage,
  StockPage,
  VehiclesManagerPage,
} from '../pages/DashboardPages'
import { DriverDeliveriesPage, DriverDeliveryDetailPage, TrackingPage } from '../pages/DriverPages'
import { DistributorOnboardingPage, DistributorRegisterPage } from '../pages/DistributorOnboardingPages'
import { LoginPage, RegisterPage } from '../pages/AuthPages'
import { LandingPage } from '../pages/LandingPage'
import { PlansPage } from '../pages/PlansPage'
import {
  CartPage,
  CheckoutPage,
  DistributorCatalogPage,
  DistributorsPage,
  HomePage,
  OrdersPage,
  ProductDetailPage,
} from '../pages/CommercePages'
import { ProtectedRoute } from '../routes/ProtectedRoute'
import { useAuthStore } from '../stores/authStore'
import { useNotificationStore } from '../stores/notificationStore'
import { defaultRouteForUser } from '../utils/authRouting'

export function App() {
  const bootstrap = useAuthStore((state) => state.bootstrap)
  const fetchNotifications = useNotificationStore((state) => state.fetchNotifications)

  useEffect(() => {
    void bootstrap().then(() => {
      if (localStorage.getItem('distromax_access')) void fetchNotifications()
    })
  }, [bootstrap, fetchNotifications])

  return (
    <Routes>
      <Route path="/" element={<LandingPage />} />
      <Route path="/login" element={<LoginPage />} />
      <Route path="/register" element={<RegisterPage />} />
      <Route path="/distributor/register" element={<DistributorRegisterPage />} />
      <Route path="/planes" element={<PlansPage />} />
      <Route element={<ProtectedRoute roles={['DISTRIBUTOR']} allowPendingDistributor />}>
        <Route path="/distributor/onboarding" element={<DistributorOnboardingPage />} />
      </Route>
      <Route element={<ProtectedRoute />}>
        <Route element={<AppLayout />}>
          <Route path="/app" element={<RoleRedirect />} />
          <Route path="/home" element={<HomePage />} />
          <Route path="/distributors" element={<DistributorsPage />} />
          <Route path="/distributors/:id" element={<DistributorCatalogPage />} />
          <Route path="/products/:id" element={<ProductDetailPage />} />
          <Route path="/cart" element={<CartPage />} />
          <Route path="/checkout" element={<CheckoutPage />} />
          <Route path="/orders" element={<OrdersPage />} />
          <Route path="/tracking/:orderId" element={<TrackingPage />} />

          <Route element={<ProtectedRoute roles={['DISTRIBUTOR']} />}>
            <Route path="/dashboard" element={<DashboardPage />} />
            <Route path="/dashboard/products" element={<ProductsManagerPage />} />
            <Route path="/dashboard/stock" element={<StockPage />} />
            <Route path="/dashboard/orders" element={<DashboardOrdersPage />} />
            <Route path="/dashboard/customers" element={<CustomersManagerPage />} />
            <Route path="/dashboard/profile" element={<DistributorProfilePage />} />
            <Route path="/dashboard/drivers" element={<DriversManagerPage />} />
            <Route path="/dashboard/vehicles" element={<VehiclesManagerPage />} />
            <Route path="/dashboard/imports" element={<ImportsPage />} />
            <Route path="/dashboard/billing" element={<BillingPage />} />
          </Route>

          <Route element={<ProtectedRoute roles={['DRIVER']} />}>
            <Route path="/driver/deliveries" element={<DriverDeliveriesPage />} />
            <Route path="/driver/deliveries/:id" element={<DriverDeliveryDetailPage />} />
          </Route>

          <Route element={<ProtectedRoute roles={['ADMIN']} />}>
            <Route path="/admin" element={<Navigate to="/admin/distributors" replace />} />
            <Route path="/admin/distributors" element={<AdminDistributorsPage />} />
            <Route path="/admin/subscriptions" element={<AdminSubscriptionsPage />} />
            <Route path="/admin/users" element={<AdminUsersPage />} />
          </Route>
        </Route>
      </Route>
    </Routes>
  )
}

function RoleRedirect() {
  const user = useAuthStore((state) => state.user)
  if (!user) return <Navigate to="/login" replace />
  return <Navigate to={defaultRouteForUser(user)} replace />
}
