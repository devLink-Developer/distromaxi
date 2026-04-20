import { Navigate, Outlet } from 'react-router-dom'

import { useAuthStore } from '../stores/authStore'
import type { Role } from '../types/domain'

export function ProtectedRoute({ roles }: { roles?: Role[] }) {
  const user = useAuthStore((state) => state.user)
  const token = useAuthStore((state) => state.token)
  if (!token) return <Navigate to="/login" replace />
  if (!user) return <div className="grid min-h-dvh place-items-center bg-slate-50 text-sm font-800 text-slate-600">Cargando sesión...</div>
  if (roles && !roles.includes(user.role)) return <Navigate to="/home" replace />
  return <Outlet />
}
