import { useEffect, useState } from 'react'
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'

import { useAuthStore } from '../stores/authStore'
import { BrandLogo } from './BrandLogo'
import { Icon } from './Icon'

type AppLink = {
  to: string
  label: string
  icon: Parameters<typeof Icon>[0]['name']
}

const mobileNavId = 'mobile-navigation-drawer'

const commerceLinks: AppLink[] = [
  { to: '/home', label: 'Inicio', icon: 'home' as const },
  { to: '/orders', label: 'Pedidos', icon: 'orders' as const },
  { to: '/account/address', label: 'Direccion', icon: 'pin' as const },
  { to: '/cart', label: 'Carrito', icon: 'cart' as const },
]

const distributorLinks: AppLink[] = [
  { to: '/dashboard', label: 'Inicio', icon: 'home' as const },
  { to: '/dashboard/orders', label: 'Pedidos', icon: 'orders' as const },
  { to: '/dashboard/routing', label: 'Rutas', icon: 'route' as const },
  { to: '/dashboard/products', label: 'Productos', icon: 'box' as const },
  { to: '/dashboard/stock', label: 'Stock', icon: 'orders' as const },
  { to: '/dashboard/customers', label: 'Clientes', icon: 'users' as const },
  { to: '/dashboard/profile', label: 'Mi cuenta', icon: 'pin' as const },
  { to: '/dashboard/drivers', label: 'Choferes', icon: 'truck' as const },
  { to: '/dashboard/vehicles', label: 'Vehiculos', icon: 'truck' as const },
  { to: '/dashboard/imports', label: 'Cargas', icon: 'upload' as const },
  { to: '/dashboard/billing', label: 'Plan', icon: 'wallet' as const },
]

const driverLinks: AppLink[] = [
  { to: '/driver/deliveries', label: 'Entregas', icon: 'truck' as const },
  { to: '/orders', label: 'Pedidos', icon: 'orders' as const },
]

const adminLinks: AppLink[] = [
  { to: '/admin/distributors', label: 'Distribuidoras', icon: 'truck' as const },
  { to: '/admin/subscriptions', label: 'Suscripciones', icon: 'wallet' as const },
  { to: '/admin/users', label: 'Usuarios', icon: 'users' as const },
]

export function AppLayout() {
  const user = useAuthStore((state) => state.user)
  const logout = useAuthStore((state) => state.logout)
  const navigate = useNavigate()
  const location = useLocation()
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)
  const links =
    user?.role === 'ADMIN'
      ? adminLinks
      : user?.role === 'DRIVER'
        ? driverLinks
        : user?.role === 'COMMERCE'
          ? commerceLinks
          : distributorLinks
  const quickLinks = links.length > 4 ? links.slice(0, 3) : links
  const showMobileMenuButton = links.length > 4

  useEffect(() => {
    setIsMobileMenuOpen(false)
  }, [location.pathname])

  useEffect(() => {
    if (!isMobileMenuOpen) return

    const previousOverflow = document.body.style.overflow
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setIsMobileMenuOpen(false)
    }

    document.body.style.overflow = 'hidden'
    window.addEventListener('keydown', handleEscape)

    return () => {
      document.body.style.overflow = previousOverflow
      window.removeEventListener('keydown', handleEscape)
    }
  }, [isMobileMenuOpen])

  const handleLogout = () => {
    setIsMobileMenuOpen(false)
    logout()
    navigate('/login')
  }

  return (
    <div className="min-h-dvh bg-slate-50">
      <aside className="fixed inset-y-0 left-0 z-[950] hidden w-72 overflow-y-auto border-r border-slate-200 bg-white px-5 py-6 overscroll-contain lg:block">
        <div className="flex min-h-full flex-col">
          <Brand />
          <PrimaryNav links={links} className="mt-8 grid gap-2 pb-6" />
        </div>
      </aside>

      {isMobileMenuOpen ? (
        <>
          <button
            type="button"
            className="fixed inset-0 z-[980] bg-slate-950/40 lg:hidden"
            aria-label="Cerrar menu"
            onClick={() => setIsMobileMenuOpen(false)}
          />
          <aside
            id={mobileNavId}
            className="fixed inset-y-0 left-0 z-[990] flex w-[min(88vw,20rem)] max-w-sm flex-col overflow-y-auto border-r border-slate-200 bg-white px-5 py-5 shadow-2xl overscroll-contain lg:hidden"
            role="dialog"
            aria-modal="true"
            aria-label="Menu de navegacion"
          >
            <div className="flex items-center justify-between gap-3">
              <Brand compact />
              <button
                type="button"
                className="inline-flex h-11 w-11 items-center justify-center rounded-md border border-slate-200 bg-white text-slate-600 transition hover:border-brand-500 hover:text-brand-700"
                aria-label="Cerrar menu"
                onClick={() => setIsMobileMenuOpen(false)}
              >
                <Icon name="close" className="h-5 w-5" />
              </button>
            </div>

            <div className="mt-6 rounded-[1.5rem] border border-slate-200 bg-slate-50 px-4 py-3">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Tu cuenta</p>
              <p className="mt-1 text-sm font-700 text-slate-950">{user?.full_name}</p>
            </div>

            <PrimaryNav
              links={links}
              className="mt-6 grid gap-2 pb-6"
              onItemClick={() => setIsMobileMenuOpen(false)}
            />

            <button
              className="mt-auto inline-flex min-h-11 items-center justify-center gap-2 rounded-md border border-slate-200 bg-white px-3 text-sm font-700 text-slate-700 transition hover:border-brand-500 hover:text-brand-700"
              type="button"
              onClick={handleLogout}
            >
              <Icon name="logout" className="h-4 w-4" />
              Salir
            </button>
          </aside>
        </>
      ) : null}

      <div className="lg:pl-72">
        <header className="sticky top-0 z-[960] border-b border-slate-200 bg-white/95 px-4 py-3 backdrop-blur md:px-8">
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
              onClick={handleLogout}
            >
              <Icon name="logout" className="h-4 w-4" />
              <span className="hidden sm:inline">Salir</span>
            </button>
          </div>
        </header>
        <main className="mx-auto w-full max-w-7xl px-4 py-6 pb-28 md:px-8 lg:pb-10">
          <Outlet />
        </main>
      </div>

      <nav
        className="fixed inset-x-0 bottom-0 z-[970] flex items-stretch gap-1 border-t border-slate-200 bg-white px-2 py-2 shadow-soft lg:hidden"
        aria-label="Navegacion inferior"
      >
        {quickLinks.map((link) => (
          <NavItem key={link.to} mobile {...link} />
        ))}
        {showMobileMenuButton ? (
          <MobileMenuButton expanded={isMobileMenuOpen} onClick={() => setIsMobileMenuOpen(true)} />
        ) : null}
      </nav>
    </div>
  )
}

function Brand({ compact = false }: { compact?: boolean }) {
  return <BrandLogo className={compact ? '' : 'rounded-[1.5rem] border border-slate-200 bg-slate-50 px-4 py-3'} size={compact ? 'compact' : 'sidebar'} />
}

function PrimaryNav({
  links,
  className,
  onItemClick,
}: {
  links: AppLink[]
  className?: string
  onItemClick?: () => void
}) {
  return (
    <nav className={className ?? 'grid gap-2'} aria-label="Navegacion principal">
      {links.map((link) => (
        <NavItem key={link.to} {...link} onClick={onItemClick} />
      ))}
    </nav>
  )
}

function MobileMenuButton({
  expanded,
  onClick,
}: {
  expanded: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      className="flex min-h-14 min-w-[4.5rem] flex-1 flex-col items-center justify-center gap-1 rounded-md px-2 text-center text-[11px] font-700 text-slate-500 transition hover:bg-slate-100 hover:text-slate-950"
      aria-controls={mobileNavId}
      aria-expanded={expanded}
      aria-label="Abrir menu completo"
      onClick={onClick}
    >
      <Icon name="menu" className="h-5 w-5" />
      Menu
    </button>
  )
}

function NavItem({
  to,
  label,
  icon,
  mobile = false,
  onClick,
}: {
  to: string
  label: string
  icon: Parameters<typeof Icon>[0]['name']
  mobile?: boolean
  onClick?: () => void
}) {
  return (
    <NavLink
      to={to}
      onClick={onClick}
      className={({ isActive }) =>
        mobile
          ? `flex min-h-14 min-w-[4.5rem] flex-1 flex-col items-center justify-center gap-1 rounded-md px-2 text-center text-[11px] font-700 leading-tight ${
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
