import { useState } from 'react'
import type { FormEvent, ReactNode } from 'react'
import { Link, useNavigate } from 'react-router-dom'

import { useAuthStore } from '../stores/authStore'
import type { Role } from '../types/domain'

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
      navigate(
        user.role === 'ADMIN'
          ? '/admin/distributors'
          : user.role === 'COMMERCE'
            ? '/home'
            : user.role === 'DRIVER'
              ? '/driver/deliveries'
              : '/dashboard',
      )
    } catch {
      setError('Email o contraseña inválidos.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <AuthShell title="Ingresá a DistroMaxi" text="Gestioná pedidos, stock, clientes y entregas.">
      <form className="grid gap-4" onSubmit={submit}>
        <label className="grid gap-1 text-sm font-700 text-slate-700">
          Email
          <input
            className="min-h-12 rounded-md border border-slate-300 px-3 text-base"
            name="email"
            type="email"
            autoComplete="email"
            defaultValue="ventas@andina.local"
            required
          />
        </label>
        <label className="grid gap-1 text-sm font-700 text-slate-700">
          Contraseña
          <input
            className="min-h-12 rounded-md border border-slate-300 px-3 text-base"
            name="password"
            type="password"
            autoComplete="current-password"
            defaultValue="Demo1234!"
            required
          />
        </label>
        {error && <p className="rounded-md bg-red-50 px-3 py-2 text-sm font-700 text-red-700">{error}</p>}
        <button
          className="min-h-12 rounded-md bg-brand-600 px-4 text-base font-800 text-white transition hover:bg-brand-700 disabled:opacity-60"
          disabled={loading}
          type="submit"
        >
          {loading ? 'Ingresando...' : 'Ingresar'}
        </button>
        <p className="text-sm text-slate-600">
          ¿Nuevo comercio?{' '}
          <Link className="font-800 text-brand-700" to="/register">
            Crear cuenta
          </Link>
        </p>
      </form>
    </AuthShell>
  )
}

export function RegisterPage() {
  const register = useAuthStore((state) => state.register)
  const [role, setRole] = useState<Role>('COMMERCE')
  const [message, setMessage] = useState('')

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    await register({
      email: form.get('email'),
      password: form.get('password'),
      full_name: form.get('full_name'),
      phone: form.get('phone'),
      role,
    })
    setMessage('Cuenta creada. Ya podés iniciar sesión.')
    event.currentTarget.reset()
  }

  return (
    <AuthShell title="Creá tu cuenta" text="Registrá un comercio, una distribuidora o un chofer para operar en DistroMaxi.">
      <form className="grid gap-4" onSubmit={submit}>
        <label className="grid gap-1 text-sm font-700 text-slate-700">
          Nombre completo
          <input className="min-h-12 rounded-md border border-slate-300 px-3" name="full_name" required />
        </label>
        <label className="grid gap-1 text-sm font-700 text-slate-700">
          Email
          <input className="min-h-12 rounded-md border border-slate-300 px-3" name="email" type="email" required />
        </label>
        <label className="grid gap-1 text-sm font-700 text-slate-700">
          Teléfono
          <input className="min-h-12 rounded-md border border-slate-300 px-3" name="phone" type="tel" required />
        </label>
        <label className="grid gap-1 text-sm font-700 text-slate-700">
          Rol
          <select
            className="min-h-12 rounded-md border border-slate-300 px-3"
            value={role}
            onChange={(event) => setRole(event.target.value as Role)}
          >
            <option value="COMMERCE">Comercio</option>
            <option value="DISTRIBUTOR">Distribuidora</option>
            <option value="DRIVER">Chofer</option>
          </select>
        </label>
        <label className="grid gap-1 text-sm font-700 text-slate-700">
          Contraseña
          <input className="min-h-12 rounded-md border border-slate-300 px-3" name="password" type="password" minLength={8} required />
        </label>
        {message && <p className="rounded-md bg-mint-50 px-3 py-2 text-sm font-700 text-mint-700">{message}</p>}
        <button className="min-h-12 rounded-md bg-brand-600 px-4 text-base font-800 text-white" type="submit">
          Crear cuenta
        </button>
        <Link className="text-sm font-800 text-brand-700" to="/login">
          Ya tengo cuenta
        </Link>
      </form>
    </AuthShell>
  )
}

function AuthShell({ title, text, children }: { title: string; text: string; children: ReactNode }) {
  return (
    <main className="grid min-h-dvh bg-slate-50 lg:grid-cols-[1.1fr_0.9fr]">
      <section className="relative hidden overflow-hidden bg-brand-600 p-10 text-white lg:block">
        <img
          className="absolute inset-0 h-full w-full object-cover opacity-30"
          src="https://images.unsplash.com/photo-1586528116311-ad8dd3c8310d?auto=format&fit=crop&w=1400&q=80"
          alt="Centro logístico mayorista con camiones de reparto"
        />
        <div className="relative z-10 flex h-full max-w-xl flex-col justify-between">
          <div className="text-2xl font-800">DistroMaxi</div>
          <div>
            <p className="text-sm font-800 uppercase tracking-[0.18em]">Distribución mayorista</p>
            <h1 className="mt-4 text-5xl font-800 leading-tight">Pedidos, stock y entregas coordinadas.</h1>
            <p className="mt-5 text-lg leading-8 text-brand-50">
              Catálogo, clientes, vehículos y choferes en un solo lugar.
            </p>
          </div>
        </div>
      </section>
      <section className="grid place-items-center px-4 py-8">
        <div className="w-full max-w-md rounded-lg border border-slate-200 bg-white p-6 shadow-soft">
          <h1 className="text-2xl font-800 text-slate-950">{title}</h1>
          <p className="mt-2 text-sm leading-6 text-slate-600">{text}</p>
          <div className="mt-6">{children}</div>
        </div>
      </section>
    </main>
  )
}
