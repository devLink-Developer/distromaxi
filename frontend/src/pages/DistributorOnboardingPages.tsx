import { useEffect, useState } from 'react'
import type { FormEvent, ReactNode } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'

import { BrandLogo } from '../components/BrandLogo'
import { ApiError, api } from '../services/api'
import { useAuthStore } from '../stores/authStore'
import type { DistributorOnboardingState } from '../types/domain'
import { defaultRouteForUser } from '../utils/authRouting'

const publicHeroImage = 'https://images.unsplash.com/photo-1586528116311-ad8dd3c8310d?auto=format&fit=crop&w=1800&q=80'

const distributorSteps = [
  { title: 'Cuenta', text: 'Creamos tu cuenta con los datos principales.' },
  { title: 'Plan', text: 'Elegi el plan que mejor se adapte a tu distribuidora.' },
  { title: 'Activacion', text: 'Cuando el pago queda confirmado, habilitamos tu panel.' },
]

export function DistributorRegisterPage() {
  const login = useAuthStore((state) => state.login)
  const user = useAuthStore((state) => state.user)
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (user) navigate(defaultRouteForUser(user), { replace: true })
  }, [navigate, user])

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError('')
    setLoading(true)
    const form = new FormData(event.currentTarget)
    const email = String(form.get('email') ?? '')
    const password = String(form.get('password') ?? '')
    try {
      await api.registerDistributor({
        business_name: form.get('business_name'),
        contact_name: form.get('contact_name'),
        email,
        phone: form.get('phone'),
        tax_id: form.get('tax_id'),
        password,
      })
      await login(email, password)
      const chosenPlan = searchParams.get('plan')
      navigate(chosenPlan ? `/planes?plan=${encodeURIComponent(chosenPlan)}` : '/planes', { replace: true })
    } catch (caught) {
      setError(errorMessage(caught, 'No pudimos crear la cuenta. Revisa los datos e intenta otra vez.'))
    } finally {
      setLoading(false)
    }
  }

  return (
    <DistributorShell
      badge="Para distribuidoras"
      title="Crea tu cuenta distribuidora"
      text="Dejanos tus datos basicos y despues elegi el plan con el que queres empezar a vender."
      asideTitle="Como sigue"
      asideText="Primero completas tus datos, despues elegis un plan y cuando el pago quede aprobado te avisamos por esta misma pantalla."
      footer={
        <div className="grid gap-2 text-sm text-slate-600">
          <p>
            Ya tenes una cuenta?{' '}
            <Link className="font-800 text-brand-700" to="/login">
              Ingresar
            </Link>
          </p>
          <p>
            Solo queres ver los planes?{' '}
            <Link className="font-800 text-brand-700" to="/planes">
              Ver planes
            </Link>
          </p>
        </div>
      }
    >
      <StepRail activeStep={0} />
      <form className="mt-8 grid gap-4" onSubmit={submit}>
        <label className="grid gap-1 text-sm font-700 text-slate-700">
          Razon social
          <input className="min-h-12 rounded-2xl border border-slate-300 px-4" name="business_name" autoComplete="organization" required />
        </label>
        <label className="grid gap-1 text-sm font-700 text-slate-700">
          Contacto principal
          <input className="min-h-12 rounded-2xl border border-slate-300 px-4" name="contact_name" autoComplete="name" required />
        </label>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="grid gap-1 text-sm font-700 text-slate-700">
            Email
            <input className="min-h-12 rounded-2xl border border-slate-300 px-4" name="email" type="email" autoComplete="email" required />
          </label>
          <label className="grid gap-1 text-sm font-700 text-slate-700">
            Telefono
            <input className="min-h-12 rounded-2xl border border-slate-300 px-4" name="phone" type="tel" autoComplete="tel" required />
          </label>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="grid gap-1 text-sm font-700 text-slate-700">
            CUIT
            <input className="min-h-12 rounded-2xl border border-slate-300 px-4" name="tax_id" inputMode="numeric" required />
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
        </div>
        {error && <p className="rounded-2xl bg-red-50 px-4 py-3 text-sm font-700 text-red-700">{error}</p>}
        <button
          className="min-h-12 rounded-full bg-brand-600 px-5 text-base font-800 text-white transition hover:bg-brand-700 disabled:opacity-60"
          disabled={loading}
          type="submit"
        >
          {loading ? 'Creando cuenta...' : 'Seguir con los planes'}
        </button>
      </form>
    </DistributorShell>
  )
}

export function DistributorOnboardingPage() {
  const user = useAuthStore((state) => state.user)
  const refreshUser = useAuthStore((state) => state.refreshUser)
  const navigate = useNavigate()
  const [onboarding, setOnboarding] = useState<DistributorOnboardingState | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [checkoutLoading, setCheckoutLoading] = useState(false)

  useEffect(() => {
    let cancelled = false
    async function load() {
      try {
        const data = await api.distributorOnboarding()
        if (!cancelled) {
          setOnboarding(data)
          setError('')
        }
      } catch (caught) {
        if (!cancelled) setError(errorMessage(caught, 'No pudimos cargar el estado de tu cuenta.'))
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    void load()
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    if (!onboarding) return
    if (onboarding.access_state !== 'ACTIVE') return
    void refreshUser().then((nextUser) => {
      if (nextUser) navigate(defaultRouteForUser(nextUser), { replace: true })
    })
  }, [navigate, onboarding, refreshUser])

  useEffect(() => {
    if (!onboarding || onboarding.status !== 'CHECKOUT_PENDING') return
    const timer = window.setInterval(() => {
      void api
        .distributorOnboarding()
        .then((data) => {
          setOnboarding(data)
          setError('')
        })
        .catch(() => undefined)
    }, 6000)
    return () => window.clearInterval(timer)
  }, [onboarding])

  async function reopenCheckout() {
    if (!onboarding?.selected_plan) return
    setCheckoutLoading(true)
    setError('')
    try {
      const response = await api.selectDistributorPlan(onboarding.selected_plan.id)
      setOnboarding(response.onboarding)
      window.location.assign(response.checkout_url)
    } catch (caught) {
      setError(errorMessage(caught, 'No pudimos volver a abrir el pago. Intenta nuevamente.'))
    } finally {
      setCheckoutLoading(false)
    }
  }

  if (loading) {
    return (
      <main className="grid min-h-dvh place-items-center bg-slate-50 px-4">
        <div className="w-full max-w-xl rounded-[2rem] border border-slate-200 bg-white p-8 text-center shadow-soft">
          <p className="text-sm font-800 uppercase tracking-[0.18em] text-brand-700">Cuenta distribuidora</p>
          <h1 className="mt-3 text-3xl font-800 text-slate-950">Estamos revisando tu cuenta</h1>
          <p className="mt-3 text-sm leading-7 text-slate-600">En unos segundos te mostramos como sigue.</p>
        </div>
      </main>
    )
  }

  return (
    <main className="min-h-dvh bg-slate-50 text-slate-950">
      <section className="relative isolate overflow-hidden bg-emerald-950">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,_rgba(52,211,153,0.22),_transparent_42%),radial-gradient(circle_at_top_right,_rgba(255,255,255,0.12),_transparent_28%)]" />
        <nav className="relative z-10 mx-auto max-w-7xl px-4 py-5 sm:px-6 lg:px-8">
          <div className="grid gap-3 rounded-[1.5rem] border border-white/15 bg-slate-950/20 p-3 backdrop-blur-sm sm:flex sm:items-center sm:justify-between sm:rounded-none sm:border-none sm:bg-transparent sm:p-0 sm:backdrop-blur-0">
            <BrandLogo className="justify-start" dark to="/" />
            <div className="grid grid-cols-2 gap-2 sm:flex sm:items-center sm:gap-2">
              <Link
                className="inline-flex min-h-11 items-center justify-center rounded-xl border border-white/20 bg-white/10 px-3 text-sm font-800 text-white transition hover:bg-white/15 sm:rounded-md sm:border-transparent sm:bg-transparent sm:px-3"
                to="/planes"
              >
                Ver planes
              </Link>
              <Link
                className="inline-flex min-h-11 items-center justify-center rounded-xl border border-white/20 bg-white/10 px-3 text-sm font-800 text-white transition hover:bg-white/15 sm:rounded-md sm:border-white/20 sm:bg-transparent sm:px-3"
                to="/login"
              >
                Cambiar cuenta
              </Link>
            </div>
          </div>
        </nav>
        <div className="relative z-10 mx-auto max-w-7xl px-4 pb-12 pt-6 sm:px-6 lg:px-8">
          <p className="w-fit rounded-md bg-amber-300 px-3 py-2 text-sm font-800 text-slate-950">Estamos preparando tu cuenta</p>
          <h1 className="mt-5 max-w-4xl text-4xl font-800 leading-tight text-white sm:text-5xl">
            {onboarding?.business_name || user?.full_name || 'Tu distribuidora'} esta cada vez mas cerca de empezar a vender.
          </h1>
          <p className="mt-4 max-w-2xl text-base leading-8 text-emerald-50">
            {statusCopy(onboarding).description}
          </p>
          <div className="mt-8">
            <StepRail activeStep={activeStepFromStatus(onboarding?.status)} inverted />
          </div>
        </div>
      </section>

      <section className="mx-auto grid max-w-7xl gap-6 px-4 py-8 sm:px-6 lg:grid-cols-[1.1fr_0.9fr] lg:px-8">
        <div className="grid gap-5">
          <StatusPanel onboarding={onboarding} />
          {error && <p className="rounded-2xl bg-red-50 px-4 py-3 text-sm font-700 text-red-700">{error}</p>}
          <article className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-soft">
            <p className="text-sm font-800 uppercase tracking-[0.18em] text-brand-700">Datos de tu cuenta</p>
            <div className="mt-5 grid gap-4 sm:grid-cols-2">
              <InfoRow label="Razon social" value={onboarding?.business_name ?? '-'} />
              <InfoRow label="CUIT" value={onboarding?.tax_id ?? '-'} />
              <InfoRow label="Contacto" value={onboarding?.contact_name ?? '-'} />
              <InfoRow label="Email" value={onboarding?.email ?? user?.email ?? '-'} />
            </div>
          </article>
          <article className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-soft">
            <p className="text-sm font-800 uppercase tracking-[0.18em] text-brand-700">Que queres hacer ahora</p>
            <div className="mt-5 flex flex-wrap gap-3">
              <Link
                className="inline-flex min-h-12 items-center justify-center rounded-full bg-slate-950 px-5 font-800 text-white transition hover:bg-slate-800"
                to="/planes"
              >
                Ver o cambiar plan
              </Link>
              {Boolean(onboarding?.selected_plan?.mp_subscription_url) && (
                <button
                  className="inline-flex min-h-12 items-center justify-center rounded-full border border-brand-200 px-5 font-800 text-brand-700 transition hover:bg-brand-50 disabled:opacity-60"
                  disabled={checkoutLoading}
                  type="button"
                  onClick={() => void reopenCheckout()}
                >
                  {checkoutLoading ? 'Abriendo pago...' : 'Volver al pago'}
                </button>
              )}
            </div>
          </article>
        </div>

        <div className="grid gap-5">
          <article className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-soft">
            <p className="text-sm font-800 uppercase tracking-[0.18em] text-brand-700">Plan elegido</p>
            {onboarding?.selected_plan ? (
              <div className="mt-4 rounded-[1.5rem] border border-slate-200 bg-slate-50 p-5">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h2 className="text-2xl font-800 text-slate-950">{onboarding.selected_plan.name}</h2>
                    <p className="mt-2 text-sm leading-6 text-slate-600">{onboarding.selected_plan.description}</p>
                  </div>
                  <p className="text-right text-2xl font-800 text-slate-950">
                    ${Number(onboarding.selected_plan.price).toLocaleString('es-AR')}
                    <span className="block text-xs font-700 uppercase text-slate-500">por mes</span>
                  </p>
                </div>
              </div>
            ) : (
              <p className="mt-4 rounded-[1.5rem] border border-dashed border-slate-300 bg-slate-50 px-4 py-5 text-sm leading-7 text-slate-600">
                Todavia no elegiste un plan. Entra a la seccion de planes para seguir.
              </p>
            )}
          </article>
          <article className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-soft">
            <p className="text-sm font-800 uppercase tracking-[0.18em] text-brand-700">Como sigue</p>
            <div className="mt-4 grid gap-3">
              {distributorSteps.map((step, index) => (
                <div key={step.title} className="rounded-[1.5rem] border border-slate-200 bg-slate-50 p-4">
                  <p className="text-xs font-800 uppercase tracking-[0.18em] text-slate-500">Paso 0{index + 1}</p>
                  <h3 className="mt-2 text-lg font-800 text-slate-950">{step.title}</h3>
                  <p className="mt-2 text-sm leading-6 text-slate-600">{step.text}</p>
                </div>
              ))}
            </div>
          </article>
        </div>
      </section>
    </main>
  )
}

function DistributorShell({
  badge,
  title,
  text,
  asideTitle,
  asideText,
  footer,
  children,
}: {
  badge: string
  title: string
  text: string
  asideTitle: string
  asideText: string
  footer?: ReactNode
  children: ReactNode
}) {
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
              to="/login"
            >
              Ingresar
            </Link>
          </div>
        </nav>

        <section className="mt-6 grid flex-1 gap-8 lg:grid-cols-[1.02fr_0.98fr] lg:items-center lg:gap-10">
          <div className="hidden max-w-2xl lg:grid lg:gap-5">
            <div>
              <p className="w-fit rounded-md bg-amber-300 px-3 py-2 text-sm font-800 text-slate-950">{badge}</p>
              <h1 className="mt-5 text-5xl font-800 leading-tight text-white">{title}</h1>
              <p className="mt-5 max-w-xl text-lg leading-8 text-emerald-50">{text}</p>
            </div>

            <div className="grid gap-4">
              <div className="rounded-[1.5rem] border border-white/15 bg-white/10 p-5 text-white backdrop-blur-sm">
                <p className="text-xs font-800 uppercase tracking-[0.18em] text-emerald-100">{asideTitle}</p>
                <p className="mt-3 text-lg font-800">{asideText}</p>
              </div>
              <div className="rounded-[1.5rem] border border-white/15 bg-white/10 p-5 text-white backdrop-blur-sm">
                <p className="text-xs font-800 uppercase tracking-[0.18em] text-emerald-100">Pago</p>
                <p className="mt-3 text-lg font-800">El pago se hace en Mercado Pago y esta pantalla te avisa cuando la cuenta queda lista.</p>
              </div>
            </div>
          </div>

          <div className="grid gap-4 lg:justify-self-end">
            <div className="rounded-[1.5rem] border border-white/15 bg-white/10 p-4 text-white backdrop-blur-sm lg:hidden">
              <p className="text-xs font-800 uppercase tracking-[0.18em] text-emerald-100">{asideTitle}</p>
              <p className="mt-2 text-base font-800">{asideText}</p>
            </div>

            <div className="w-full max-w-xl rounded-[2rem] border border-white/80 bg-white p-6 shadow-[0_28px_80px_rgba(15,23,42,0.16)] sm:p-8">
              <p className="w-fit rounded-full bg-brand-50 px-3 py-1 text-xs font-800 uppercase tracking-[0.16em] text-brand-700">{badge}</p>
              <h1 className="mt-4 text-3xl font-800 text-slate-950">{title}</h1>
              <p className="mt-3 text-sm leading-7 text-slate-600">{text}</p>
              <div className="mt-8">{children}</div>
              {footer && <div className="mt-8">{footer}</div>}
            </div>
          </div>
        </section>
      </div>
    </main>
  )
}

function StepRail({ activeStep, inverted = false }: { activeStep: number; inverted?: boolean }) {
  return (
    <div className="grid gap-3 sm:grid-cols-3">
      {distributorSteps.map((step, index) => {
        const active = index <= activeStep
        return (
          <div
            key={step.title}
            className={`rounded-[1.5rem] border p-4 ${
              inverted
                ? active
                  ? 'border-white/30 bg-white/10 text-white'
                  : 'border-white/15 bg-slate-950/20 text-emerald-100'
                : active
                  ? 'border-brand-200 bg-brand-50 text-slate-950'
                  : 'border-slate-200 bg-slate-50 text-slate-600'
            }`}
          >
            <p className={`text-xs font-800 uppercase tracking-[0.18em] ${inverted ? 'text-inherit' : active ? 'text-brand-700' : 'text-slate-500'}`}>Paso 0{index + 1}</p>
            <h2 className="mt-2 text-base font-800">{step.title}</h2>
            <p className="mt-2 text-sm leading-6 opacity-90">{step.text}</p>
          </div>
        )
      })}
    </div>
  )
}

function StatusPanel({ onboarding }: { onboarding: DistributorOnboardingState | null }) {
  const copy = statusCopy(onboarding)
  return (
    <article className={`rounded-[2rem] border p-6 shadow-soft ${copy.classes}`}>
      <p className="text-sm font-800 uppercase tracking-[0.18em]">{copy.eyebrow}</p>
      <h2 className="mt-3 text-2xl font-800">{copy.title}</h2>
      <p className="mt-3 text-sm leading-7">{copy.description}</p>
      {copy.note && <p className="mt-3 text-sm font-700 leading-6">{copy.note}</p>}
    </article>
  )
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[1.5rem] border border-slate-200 bg-slate-50 p-4">
      <p className="text-xs font-800 uppercase tracking-[0.18em] text-slate-500">{label}</p>
      <p className="mt-2 text-base font-800 text-slate-950">{value}</p>
    </div>
  )
}

function activeStepFromStatus(status?: string | null) {
  if (status === 'ACTIVE') return 2
  if (status === 'PLAN_SELECTED' || status === 'CHECKOUT_PENDING' || status === 'REVIEW_REQUIRED' || status === 'FAILED') return 1
  return 0
}

function statusCopy(onboarding: DistributorOnboardingState | null) {
  switch (onboarding?.access_state) {
    case 'ACTIVE':
      return {
        eyebrow: 'Cuenta lista',
        title: 'Tu plan ya esta confirmado.',
        description: 'Tu distribuidora ya puede entrar al panel. Estamos actualizando tu acceso.',
        note: '',
        classes: 'border-emerald-200 bg-emerald-50 text-emerald-950',
      }
    case 'REVIEW_REQUIRED':
      return {
        eyebrow: 'Necesitamos revisarlo',
        title: 'Estamos chequeando tu pago.',
        description: 'Nos llego un aviso y estamos terminando de validar la cuenta.',
        note: onboarding.review_reason || 'Si queres, podes volver a intentar el pago o esperar nuestra confirmacion.',
        classes: 'border-amber-200 bg-amber-50 text-amber-950',
      }
    case 'FAILED':
      return {
        eyebrow: 'No pudimos terminar el alta',
        title: 'El pago no pudo confirmarse.',
        description: 'Tu cuenta sigue guardada para que puedas intentarlo de nuevo cuando quieras.',
        note: onboarding.failure_reason || 'Podes volver al pago y terminar el alta.',
        classes: 'border-red-200 bg-red-50 text-red-950',
      }
    default:
      return {
        eyebrow: 'Seguimos con el alta',
        title: onboarding?.selected_plan ? 'Estamos revisando tu pago.' : 'Falta elegir un plan.',
        description: onboarding?.selected_plan
          ? 'Apenas el pago quede confirmado, tu cuenta va a quedar lista y vas a poder entrar al panel.'
          : 'Tu cuenta ya esta creada. Ahora elegi el plan con el que queres empezar.',
        note: onboarding?.selected_plan ? 'Si ya pagaste, no hace falta repetirlo: esta pantalla se actualiza sola.' : '',
        classes: 'border-brand-200 bg-brand-50 text-slate-950',
      }
  }
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
