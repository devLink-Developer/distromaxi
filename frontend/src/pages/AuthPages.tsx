import { useState } from 'react'
import type { FormEvent, ReactNode } from 'react'
import { Link, useNavigate } from 'react-router-dom'

import { ApiError } from '../services/api'
import { useAuthStore } from '../stores/authStore'
import { defaultRouteForUser } from '../utils/authRouting'

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
      title="Ingresa a DistroMaxi"
      text="Compra, sigue pedidos o entra a tu panel operativo desde una sola cuenta."
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
            No tienes cuenta de cliente?{' '}
            <Link className="font-800 text-brand-700" to="/register">
              Crear cuenta
            </Link>
          </p>
          <p>
            Eres distribuidora?{' '}
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
        address: form.get('address'),
        city: form.get('city'),
        province: form.get('province'),
        password: form.get('password'),
      })
      setMessage('Cuenta de cliente creada. Ya puedes ingresar.')
      event.currentTarget.reset()
    } catch (caught) {
      setError(errorMessage(caught, 'No se pudo crear la cuenta. Revisa los datos e intenta otra vez.'))
    } finally {
      setLoading(false)
    }
  }

  return (
    <AuthShell
      title="Crea tu cuenta de cliente"
      text="Registra tu negocio para comprar a distribuidoras, armar pedidos y seguir entregas."
    >
      <form className="grid gap-4" onSubmit={submit}>
        <label className="grid gap-1 text-sm font-700 text-slate-700">
          Nombre completo
          <input className="min-h-12 rounded-2xl border border-slate-300 px-4" name="full_name" autoComplete="name" required />
        </label>
        <label className="grid gap-1 text-sm font-700 text-slate-700">
          Nombre del negocio
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
          Direccion de entrega
          <input className="min-h-12 rounded-2xl border border-slate-300 px-4" name="address" autoComplete="street-address" required />
        </label>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="grid gap-1 text-sm font-700 text-slate-700">
            Ciudad
            <input className="min-h-12 rounded-2xl border border-slate-300 px-4" name="city" autoComplete="address-level2" />
          </label>
          <label className="grid gap-1 text-sm font-700 text-slate-700">
            Provincia
            <input className="min-h-12 rounded-2xl border border-slate-300 px-4" name="province" autoComplete="address-level1" />
          </label>
        </div>
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
            Las distribuidoras tienen un onboarding aparte con cuenta basica, plan y activacion por suscripcion.
          </p>
          <p>
            Eres distribuidora?{' '}
            <Link className="font-800 text-brand-700" to="/planes">
              Revisar planes
            </Link>
          </p>
        </div>
      </form>
    </AuthShell>
  )
}

function AuthShell({ title, text, children }: { title: string; text: string; children: ReactNode }) {
  return (
    <main className="grid min-h-dvh bg-[#f7f1e8] lg:grid-cols-[1.08fr_0.92fr]">
      <section className="relative hidden overflow-hidden bg-slate-950 p-10 text-white lg:block">
        <img
          className="absolute inset-0 h-full w-full object-cover opacity-45"
          src="https://images.unsplash.com/photo-1542838132-92c53300491e?auto=format&fit=crop&w=1400&q=80"
          alt="Productos listos para reposicion en un comercio"
        />
        <div className="absolute inset-0 bg-gradient-to-br from-slate-950 via-slate-950/70 to-brand-700/65" />
        <div className="relative z-10 flex h-full max-w-xl flex-col justify-between">
          <div className="flex items-center justify-between gap-4">
            <Link className="text-2xl font-800 tracking-[0.08em] text-white" to="/">
              DISTROMAXI
            </Link>
            <Link className="text-sm font-800 text-brand-100 transition hover:text-white" to="/planes">
              Soy distribuidora
            </Link>
          </div>

          <div>
            <p className="text-sm font-800 uppercase tracking-[0.2em] text-brand-100">Canal clientes + operaciones</p>
            <h1 className="mt-4 text-5xl font-800 leading-tight">Compra mejor, sigue pedidos y entra a tu operacion desde la misma plataforma.</h1>
            <p className="mt-5 text-lg leading-8 text-slate-200">
              Clientes, distribuidoras y choferes entran por flujos distintos, sin mezclar altas publicas con cuentas
              internas.
            </p>
          </div>

          <div className="grid gap-4">
            <div className="rounded-[1.5rem] border border-white/15 bg-white/10 p-5 backdrop-blur-sm">
              <p className="text-xs font-800 uppercase tracking-[0.18em] text-brand-100">Alta publica</p>
              <p className="mt-3 text-lg font-800">Clientes y distribuidoras se registran por flujos distintos, cada uno con su propio objetivo.</p>
            </div>
            <div className="rounded-[1.5rem] border border-white/15 bg-white/10 p-5 backdrop-blur-sm">
              <p className="text-xs font-800 uppercase tracking-[0.18em] text-brand-100">Provision operativa</p>
              <p className="mt-3 text-lg font-800">Los choferes siguen naciendo desde cada dashboard distribuidor, no desde la landing publica.</p>
            </div>
          </div>
        </div>
      </section>

      <section className="grid place-items-center px-4 py-8 sm:px-6 lg:px-10">
        <div className="w-full max-w-lg rounded-[2rem] border border-white/70 bg-white/92 p-6 shadow-[0_28px_80px_rgba(15,23,42,0.12)] backdrop-blur-sm sm:p-8">
          <div className="flex items-center justify-between gap-4 lg:hidden">
            <Link className="text-lg font-800 tracking-[0.08em] text-slate-950" to="/">
              DISTROMAXI
            </Link>
            <Link className="text-sm font-800 text-brand-700" to="/planes">
              Soy distribuidora
            </Link>
          </div>
          <h1 className="mt-6 text-3xl font-800 text-slate-950 lg:mt-0">{title}</h1>
          <p className="mt-3 text-sm leading-7 text-slate-600">{text}</p>
          <div className="mt-8">{children}</div>
        </div>
      </section>
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
