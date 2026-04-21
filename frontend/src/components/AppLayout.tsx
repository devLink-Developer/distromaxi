import { NavLink, Outlet, useNavigate } from 'react-router-dom'

import { useAuthStore } from '../stores/authStore'
import { Icon } from './Icon'

const commerceLinks = [
  { to: '/home', label: 'Inicio', icon: 'home' as const },
  { to: '/orders', label: 'Pedidos', icon: 'orders' as const },
  { to: '/cart', label: 'Carrito', icon: 'cart' as const },
]

const distributorLinks = [
  { to: '/dashboard', label: 'Inicio', icon: 'home' as const },
  { to: '/dashboard/orders', label: 'Pedidos', icon: 'orders' as const },
  { to: '/dashboard/products', label: 'Productos', icon: 'box' as const },
  { to: '/dashboard/stock', label: 'Stock', icon: 'orders' as const },
  { to: '/dashboard/customers', label: 'Clientes', icon: 'users' as const },
  { to: '/dashboard/profile', label: 'Mi cuenta', icon: 'pin' as const },
  { to: '/dashboard/drivers', label: 'Choferes', icon: 'route' as const },
  { to: '/dashboard/vehicles', label: 'Vehiculos', icon: 'truck' as const },
  { to: '/dashboard/imports', label: 'Cargas', icon: 'upload' as const },
  { to: '/dashboard/billing', label: 'Plan', icon: 'wallet' as const },
]

const driverLinks = [
  { to: '/driver/deliveries', label: 'Entregas', icon: 'truck' as const },
  { to: '/orders', label: 'Pedidos', icon: 'orders' as const },
]

const adminLinks = [
  { to: '/admin/distributors', label: 'Distribuidoras', icon: 'truck' as const },
  { to: '/admin/subscriptions', label: 'Suscripciones', icon: 'wallet' as const },
  { to: '/admin/users', label: 'Usuarios', icon: 'users' as const },
]

export function AppLayout() {
  const user = useAuthStore((state) => state.user)
  const logout = useAuthStore((state) => state.logout)
  const navigate = useNavigate()
  const links =
    user?.role === 'ADMIN'
      ? adminLinks
      : user?.role === 'DRIVER'
        ? driverLinks
        : user?.role === 'COMMERCE'
          ? commerceLinks
          : distributorLinks

  return (
    <div className="min-h-dvh bg-slate-50">
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-72 border-r border-slate-200 bg-white px-5 py-6 lg:block">
        <Brand />
        <nav className="mt-8 grid gap-2" aria-label="Navegacion principal">
          {links.map((link) => (
            <NavItem key={link.to} {...link} />
          ))}
        </nav>
      </aside>

      <div className="lg:pl-72">
        <header className="sticky top-0 z-20 border-b border-slate-200 bg-white/95 px-4 py-3 backdrop-blur md:px-8">
          <div className="flex items-center justify-between gap-4">
            <div className="lg:hidden">
              <Brand compact />
            </div>
            <div className="hidden lg:block">
              <p className="text-sm font-semibold text-slate-500">Tu cuenta</p>
              <p className="text-base font-700 text-slate-950">{user?.full_name}</p>
            </div>
            <button
              className="inline-flex min-h-11 items-center gap-2 rounded-md border border-slate-200 bg-white px-3 text-sm font-700 text-slate-700 transition hover:border-brand-500 hover:text-brand-700"
              type="button"
              onClick={() => {
                logout()
                navigate('/login')
              }}
            >
              <Icon name="logout" className="h-4 w-4" />
              Salir
            </button>
          </div>
        </header>
        <main className="mx-auto w-full max-w-7xl px-4 py-6 pb-28 md:px-8 lg:pb-10">
          <Outlet />
        </main>
      </div>

      <nav
        className="fixed inset-x-0 bottom-0 z-40 grid grid-cols-4 border-t border-slate-200 bg-white px-2 py-2 shadow-soft lg:hidden"
        aria-label="Navegacion inferior"
      >
        {links.slice(0, 4).map((link) => (
          <NavItem key={link.to} mobile {...link} />
        ))}
      </nav>
    </div>
  )
}

function Brand({ compact = false }: { compact?: boolean }) {
  return (
    <div className="flex items-center gap-3">
      <div className="grid h-11 w-11 place-items-center rounded-lg bg-brand-600 text-white">
        <Icon name="truck" />
      </div>
      {!compact && (
        <div>
          <p className="text-lg font-800 text-slate-950">DistroMaxi</p>
          <p className="text-xs font-semibold text-slate-500">Pedidos y entregas</p>
        </div>
      )}
    </div>
  )
}

function NavItem({
  to,
  label,
  icon,
  mobile = false,
}: {
  to: string
  label: string
  icon: Parameters<typeof Icon>[0]['name']
  mobile?: boolean
}) {
  return (
    <NavLink
      to={to}
      className={({ isActive }) =>
        mobile
          ? `flex min-h-14 flex-col items-center justify-center gap-1 rounded-md text-xs font-700 ${
              isActive ? 'bg-brand-50 text-brand-700' : 'text-slate-500'
            }`
          : `flex min-h-11 items-center gap-3 rounded-md px-3 text-sm font-700 transition ${
              isActive ? 'bg-brand-50 text-brand-700' : 'text-slate-600 hover:bg-slate-100 hover:text-slate-950'
            }`
      }
    >
      <Icon name={icon} className={mobile ? 'h-5 w-5' : 'h-4 w-4'} />
      {label}
    </NavLink>
  )
}
