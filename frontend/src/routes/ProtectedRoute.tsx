import { Navigate, Outlet, useLocation } from 'react-router-dom'

import { useAuthStore } from '../stores/authStore'
import type { Role } from '../types/domain'
import { distributorNeedsOnboarding } from '../utils/authRouting'

export function ProtectedRoute({ roles, allowPendingDistributor = false }: { roles?: Role[]; allowPendingDistributor?: boolean }) {
  const user = useAuthStore((state) => state.user)
  const token = useAuthStore((state) => state.token)
  const location = useLocation()

  if (!token) return <Navigate to="/login" replace />
  if (!user) return <div className="grid min-h-dvh place-items-center bg-slate-50 text-sm font-800 text-slate-600">Cargando sesion...</div>
  if (distributorNeedsOnboarding(user) && !allowPendingDistributor) {
    return <Navigate to="/distributor/onboarding" replace state={{ from: location.pathname }} />
  }
  if (roles && !roles.includes(user.role)) return <Navigate to="/home" replace />
  if (allowPendingDistributor && user.role === 'DISTRIBUTOR' && user.distributor_access.state === 'ACTIVE') {
    return <Navigate to="/dashboard" replace />
  }
  return <Outlet />
}
