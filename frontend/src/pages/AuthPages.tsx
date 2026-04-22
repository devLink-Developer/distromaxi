import { useState } from 'react'
import type { FormEvent, ReactNode } from 'react'
import { Link, useNavigate } from 'react-router-dom'

import { BrandLogo } from '../components/BrandLogo'
import { ApiError } from '../services/api'
import { useAuthStore } from '../stores/authStore'
import { defaultRouteForUser } from '../utils/authRouting'

const publicHeroImage = 'https://images.unsplash.com/photo-1586528116311-ad8dd3c8310d?auto=format&fit=crop&w=1800&q=80'

export function LoginPage() {
  const login = useAuthStore((state) => state.login)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const navigate = useNavigate()

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError('')
    setLoading(true)
    const form = new FormData(event.currentTarget)
    try {
      const user = await login(String(form.get('email')), String(form.get('password')))
      navigate(defaultRouteForUser(user))
    } catch (caught) {
      setError(errorMessage(caught, 'Email o contrasena invalidos.'))
    } finally {
      setLoading(false)
    }
  }

  return (
    <AuthShell
      badge="Ingresar"
      title="Ingresa a DistroMaxi"
      text="Compra, mira tus pedidos o entra a tu panel desde una sola cuenta."
    >
      <form className="grid gap-4" onSubmit={submit}>
        <label className="grid gap-1 text-sm font-700 text-slate-700">
          Email
          <input
            className="min-h-12 rounded-2xl border border-slate-300 px-4 text-base"
            name="email"
            type="email"
            autoComplete="email"
            defaultValue="ventas@andina.local"
            required
          />
        </label>
        <label className="grid gap-1 text-sm font-700 text-slate-700">
          Contrasena
          <input
            className="min-h-12 rounded-2xl border border-slate-300 px-4 text-base"
            name="password"
            type="password"
            autoComplete="current-password"
            defaultValue="Demo1234!"
            required
          />
        </label>
        {error && <p className="rounded-2xl bg-red-50 px-4 py-3 text-sm font-700 text-red-700">{error}</p>}
        <button
          className="min-h-12 rounded-full bg-slate-950 px-5 text-base font-800 text-white transition hover:bg-slate-800 disabled:opacity-60"
          disabled={loading}
          type="submit"
        >
          {loading ? 'Ingresando...' : 'Ingresar'}
        </button>
        <div className="grid gap-2 text-sm text-slate-600">
          <p>
            No tenes cuenta de cliente?{' '}
            <Link className="font-800 text-brand-700" to="/register">
              Crear cuenta
            </Link>
          </p>
          <p>
            Sos distribuidora?{' '}
            <Link className="font-800 text-brand-700" to="/distributor/register">
              Crear cuenta y elegir plan
            </Link>
          </p>
        </div>
      </form>
    </AuthShell>
  )
}

export function RegisterPage() {
  const register = useAuthStore((state) => state.register)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError('')
    setMessage('')
    setLoading(true)
    const form = new FormData(event.currentTarget)
    try {
      await register({
        full_name: form.get('full_name'),
        trade_name: form.get('trade_name'),
        email: form.get('email'),
        phone: form.get('phone'),
        password: form.get('password'),
      })
      setMessage('Cuenta de cliente creada. Ya podes ingresar.')
      event.currentTarget.reset()
    } catch (caught) {
      setError(errorMessage(caught, 'No se pudo crear la cuenta. Revisa los datos e intenta otra vez.'))
    } finally {
      setLoading(false)
    }
  }

  return (
    <AuthShell
      badge="Cuenta de cliente"
      title="Crea tu cuenta de cliente"
      text="Registra tu negocio para comprar a distribuidoras, armar pedidos y seguir entregas."
    >
      <form className="grid gap-4" onSubmit={submit}>
        <label className="grid gap-1 text-sm font-700 text-slate-700">
          Nombre completo
          <input className="min-h-12 rounded-2xl border border-slate-300 px-4" name="full_name" autoComplete="name" required />
        </label>
        <label className="grid gap-1 text-sm font-700 text-slate-700">
          Nombre comercial
          <input className="min-h-12 rounded-2xl border border-slate-300 px-4" name="trade_name" required />
        </label>
        <label className="grid gap-1 text-sm font-700 text-slate-700">
          Email
          <input className="min-h-12 rounded-2xl border border-slate-300 px-4" name="email" type="email" autoComplete="email" required />
        </label>
        <label className="grid gap-1 text-sm font-700 text-slate-700">
          Telefono
          <input className="min-h-12 rounded-2xl border border-slate-300 px-4" name="phone" type="tel" autoComplete="tel" required />
        </label>
        <label className="grid gap-1 text-sm font-700 text-slate-700">
          Contrasena
          <input
            className="min-h-12 rounded-2xl border border-slate-300 px-4"
            name="password"
            type="password"
            autoComplete="new-password"
            minLength={8}
            required
          />
        </label>
        <p className="rounded-2xl border border-emerald-100 bg-emerald-50 px-4 py-3 text-sm font-700 leading-6 text-emerald-900">
          La direccion la completas despues desde tu cuenta.
        </p>
        {error && <p className="rounded-2xl bg-red-50 px-4 py-3 text-sm font-700 text-red-700">{error}</p>}
        {message && <p className="rounded-2xl bg-mint-50 px-4 py-3 text-sm font-700 text-mint-700">{message}</p>}
        <button
          className="min-h-12 rounded-full bg-brand-600 px-5 text-base font-800 text-white transition hover:bg-brand-700 disabled:opacity-60"
          disabled={loading}
          type="submit"
        >
          {loading ? 'Creando cuenta...' : 'Crear cuenta'}
        </button>
        <div className="grid gap-2 text-sm text-slate-600">
          <p>
            Si queres vender con DistroMaxi, entra por la seccion para distribuidoras.
          </p>
          <p>
            Sos distribuidora?{' '}
            <Link className="font-800 text-brand-700" to="/planes">
              Ver planes para distribuidoras
            </Link>
          </p>
        </div>
      </form>
    </AuthShell>
  )
}

function AuthShell({ badge, title, text, children }: { badge: string; title: string; text: string; children: ReactNode }) {
  return (
    <main className="relative isolate min-h-dvh overflow-hidden bg-slate-950">
      <img className="absolute inset-0 h-full w-full object-cover" src={publicHeroImage} alt="Centro de distribucion con pedidos listos para despacho" />
      <div className="absolute inset-0 bg-emerald-950/70" />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,_rgba(52,211,153,0.18),_transparent_34%),linear-gradient(180deg,rgba(2,44,34,0.16)_0%,rgba(2,44,34,0.4)_100%)]" />

      <div className="relative z-10 mx-auto flex min-h-dvh max-w-7xl flex-col px-4 py-5 sm:px-6 lg:px-8">
        <nav className="grid gap-3 rounded-[1.5rem] border border-white/15 bg-slate-950/20 p-3 backdrop-blur-sm sm:flex sm:items-center sm:justify-between sm:rounded-none sm:border-none sm:bg-transparent sm:p-0 sm:backdrop-blur-0">
          <BrandLogo className="justify-start" dark to="/" />
          <div className="grid grid-cols-2 gap-2 sm:flex sm:items-center sm:gap-2">
            <Link
              className="inline-flex min-h-11 items-center justify-center rounded-xl border border-white/20 bg-white/10 px-3 text-sm font-800 text-white transition hover:bg-white/15 sm:rounded-md sm:border-transparent sm:bg-transparent sm:px-3"
              to="/"
            >
              Ir al inicio
            </Link>
            <Link
              className="inline-flex min-h-11 items-center justify-center rounded-xl border border-white/20 bg-white/10 px-3 text-sm font-800 text-white transition hover:bg-white/15 sm:rounded-md sm:border-transparent sm:bg-transparent sm:px-3"
              to="/planes"
            >
              Soy distribuidora
            </Link>
          </div>
        </nav>

        <section className="mt-6 grid flex-1 gap-8 lg:grid-cols-[1.02fr_0.98fr] lg:items-center lg:gap-10">
          <div className="hidden max-w-2xl lg:grid lg:gap-5">
            <div>
              <p className="w-fit rounded-md bg-amber-300 px-3 py-2 text-sm font-800 text-slate-950">Clientes y distribuidoras</p>
              <h1 className="mt-5 text-5xl font-800 leading-tight text-white">Compra y vende con recorridos claros desde el primer paso.</h1>
              <p className="mt-5 max-w-xl text-lg leading-8 text-emerald-50">
                Cada cuenta entra por su propio camino para que comprar, vender y repartir sea simple desde el inicio.
              </p>
            </div>

            <div className="grid gap-4">
              <div className="rounded-[1.5rem] border border-white/15 bg-white/10 p-5 text-white backdrop-blur-sm">
                <p className="text-xs font-800 uppercase tracking-[0.18em] text-emerald-100">Cuenta de cliente</p>
                <p className="mt-3 text-lg font-800">Si queres comprar, en pocos pasos ya podes entrar, buscar productos y hacer pedidos.</p>
              </div>
              <div className="rounded-[1.5rem] border border-white/15 bg-white/10 p-5 text-white backdrop-blur-sm">
                <p className="text-xs font-800 uppercase tracking-[0.18em] text-emerald-100">Cuenta distribuidora</p>
                <p className="mt-3 text-lg font-800">Si queres vender, creas tu cuenta, elegis un plan y despues ya podes usar tu panel.</p>
              </div>
            </div>
          </div>

          <div className="grid gap-4 lg:justify-self-end">
            <div className="rounded-[1.5rem] border border-white/15 bg-white/10 p-4 text-white backdrop-blur-sm lg:hidden">
              <p className="text-xs font-800 uppercase tracking-[0.18em] text-emerald-100">Acceso simple</p>
              <p className="mt-2 text-base font-800">Entra a tu cuenta o crea una nueva sin salir del mismo entorno visual del landing.</p>
            </div>

            <div className="w-full max-w-xl rounded-[2rem] border border-white/80 bg-white p-6 shadow-[0_28px_80px_rgba(15,23,42,0.16)] sm:p-8">
              <p className="w-fit rounded-full bg-brand-50 px-3 py-1 text-xs font-800 uppercase tracking-[0.16em] text-brand-700">{badge}</p>
              <h1 className="mt-4 text-3xl font-800 text-slate-950">{title}</h1>
              <p className="mt-3 text-sm leading-7 text-slate-600">{text}</p>
              <div className="mt-8">{children}</div>
            </div>
          </div>
        </section>
      </div>
    </main>
  )
}

function errorMessage(error: unknown, fallback: string) {
  if (!(error instanceof ApiError)) return fallback
  if (typeof error.details === 'string' && error.details.trim()) return error.details
  if (error.details && typeof error.details === 'object') {
    const firstMessage = Object.values(error.details as Record<string, unknown>)
      .flatMap((value) => (Array.isArray(value) ? value : [value]))
      .find((value) => typeof value === 'string' && value.trim())
    if (typeof firstMessage === 'string') return firstMessage
  }
  return fallback
}
