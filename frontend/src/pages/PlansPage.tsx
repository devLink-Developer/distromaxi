import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'

import { BrandLogo } from '../components/BrandLogo'
import { EmptyState } from '../components/EmptyState'
import { ApiError, api } from '../services/api'
import { useAuthStore } from '../stores/authStore'
import { useFeedbackStore } from '../stores/feedbackStore'
import type { Plan } from '../types/domain'

const fallbackPlans: Plan[] = []

export function PlansPage() {
  const [plans, setPlans] = useState<Plan[]>(fallbackPlans)
  const [loading, setLoading] = useState(true)
  const [checkoutPlanId, setCheckoutPlanId] = useState<number | null>(null)
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const user = useAuthStore((state) => state.user)
  const selectedPlanName = searchParams.get('plan')
  const showError = useFeedbackStore((state) => state.error)

  useEffect(() => {
    void api
      .plans()
      .then((data) => {
        setPlans(data)
      })
      .catch(() => showError('No pudimos cargar los planes. Prueba otra vez en unos minutos.'))
      .finally(() => setLoading(false))
  }, [showError])

  const activePlans = useMemo(() => plans.filter((plan) => plan.is_active).sort((a, b) => a.sort_order - b.sort_order), [plans])
  const primaryPlanName = activePlans[0]?.name ?? 'MaxiGestion'
  const customersCount = 120
  const distributorIsLogged = user?.role === 'DISTRIBUTOR'
  const distributorIsActive = user?.role === 'DISTRIBUTOR' && user.distributor_access.state === 'ACTIVE'

  async function selectPlan(plan: Plan) {
    if (distributorIsActive) {
      navigate('/dashboard/billing')
      return
    }
    if (!distributorIsLogged) {
      navigate(`/distributor/register?plan=${encodeURIComponent(plan.name)}`)
      return
    }
    setCheckoutPlanId(plan.id)
    try {
      const response = await api.selectDistributorPlan(plan.id)
      window.location.assign(response.checkout_url)
    } catch (caught) {
      showError(errorMessage(caught, 'No pudimos abrir la activacion. Revisa el plan e intenta otra vez.'))
    } finally {
      setCheckoutPlanId(null)
    }
  }

  return (
    <main className="min-h-dvh bg-slate-50 text-slate-950">
      <section className="relative isolate min-h-[72dvh] overflow-hidden">
        <img
          className="absolute inset-0 h-full w-full object-cover"
          src="https://images.unsplash.com/photo-1586528116311-ad8dd3c8310d?auto=format&fit=crop&w=1800&q=80"
          alt="Centro de distribucion con pedidos listos para despacho"
        />
        <div className="absolute inset-0 bg-emerald-950/70" />
        <nav className="relative z-10 border-b border-slate-200 bg-white">
          <div className="mx-auto grid max-w-7xl gap-3 px-4 py-4 sm:px-6 lg:flex lg:items-center lg:justify-between lg:px-8">
            <BrandLogo className="justify-start" dark size="nav" to="/" />
            <div className="grid grid-cols-2 gap-2 sm:flex sm:items-center sm:gap-2">
              <Link
                className="inline-flex min-h-11 items-center justify-center rounded-xl border border-slate-200 bg-slate-100 px-3 text-sm font-800 text-slate-800 transition hover:bg-slate-200 hover:text-slate-950 sm:rounded-md"
                to="/"
              >
                Soy cliente
              </Link>
              <Link
                className="inline-flex min-h-11 items-center justify-center rounded-xl border border-slate-200 bg-slate-100 px-3 text-sm font-800 text-slate-800 transition hover:bg-slate-200 hover:text-slate-950 sm:rounded-md"
                to="/login"
              >
                Ingresar
              </Link>
              <Link
                className="col-span-2 inline-flex min-h-11 items-center justify-center rounded-xl bg-emerald-950 px-4 text-sm font-800 text-white transition hover:bg-emerald-900 sm:col-span-1 sm:rounded-md"
                to="/register"
              >
                Alta clientes
              </Link>
            </div>
          </div>
        </nav>
        <div className="relative z-10 mx-auto grid max-w-7xl gap-8 px-4 pb-12 pt-10 sm:px-6 lg:px-8 lg:pt-16">
          <p className="w-fit rounded-md bg-amber-300 px-3 py-2 text-sm font-800 text-slate-950">Oferta de lanzamiento</p>
          <div className="max-w-4xl">
            <h1 className="text-4xl font-800 leading-tight text-white sm:text-5xl lg:text-6xl">MaxiGestion para vender online sin costo durante 60 dias.</h1>
            <p className="mt-5 max-w-2xl text-lg leading-8 text-emerald-50">Un solo plan para empezar: catalogo, pedidos, stock, reportes y entregas organizadas desde la misma cuenta.</p>
          </div>
          <div className="grid max-w-3xl gap-3 sm:grid-cols-3">
            <HeroStat value={`${customersCount}+`} label="negocios comprando con DistroMaxi" />
            <HeroStat value="60 dias" label="de prueba totalmente gratis" />
            <HeroStat value="1 plan" label="sin comparativas ni sorpresas para arrancar" />
          </div>
        </div>
      </section>

      <section id="planes" className="mx-auto grid max-w-7xl gap-8 px-4 py-10 sm:px-6 lg:px-8">
        {user?.role === 'DISTRIBUTOR' && (
          <div className="rounded-[2rem] border border-brand-200 bg-white p-6 shadow-soft">
            <p className="text-sm font-800 uppercase tracking-[0.18em] text-brand-700">Paso 2 de 3</p>
            <h2 className="mt-3 text-2xl font-800 text-slate-950">
              {distributorIsActive ? 'Tu cuenta ya esta lista.' : 'Tu cuenta ya esta creada. Falta elegir un plan.'}
            </h2>
            <p className="mt-3 max-w-3xl text-sm leading-7 text-slate-600">
              {distributorIsActive
                ? 'Podes revisar tu plan actual y seguir configurando tu distribuidora desde el panel.'
                : 'Activa el plan para seguir. Te avisamos cuando la cuenta quede lista.'}
            </p>
            {!distributorIsActive && (
              <Link className="mt-5 inline-flex min-h-11 items-center rounded-full border border-slate-300 px-4 text-sm font-800 text-slate-700 transition hover:bg-slate-50" to="/distributor/onboarding">
                Ver como sigue el alta
              </Link>
            )}
          </div>
        )}

        <div className="max-w-3xl">
          <p className="text-sm font-800 uppercase text-brand-700">Plan unico</p>
          <h2 className="mt-2 text-3xl font-800 tracking-tight text-slate-950">Empeza con {primaryPlanName}</h2>
          <p className="mt-3 text-base leading-7 text-slate-600">La prueba gratis se activa para nuevas distribuidoras durante 60 dias. Despues podes continuar con la suscripcion mensual.</p>
        </div>
        {loading ? (
          <div className="grid max-w-3xl gap-4">
            {[0].map((item) => (
              <div key={item} className="h-80 animate-pulse rounded-lg border border-slate-200 bg-white" />
            ))}
          </div>
        ) : activePlans.length === 0 ? (
          <EmptyState title="No hay planes disponibles" text="Intenta nuevamente en unos minutos." />
        ) : (
          <div className={`grid gap-4 ${activePlans.length === 1 ? 'max-w-3xl' : 'md:grid-cols-3'}`}>
            {activePlans.map((plan) => (
              <PlanCard
                key={plan.name}
                plan={plan}
                highlighted={selectedPlanName === plan.name}
                loading={checkoutPlanId === plan.id}
                activeDistributor={distributorIsActive}
                onSelect={selectPlan}
                requiresSignup={!distributorIsLogged}
              />
            ))}
          </div>
        )}
      </section>

      <section className="bg-white">
        <div className="mx-auto grid max-w-7xl gap-8 px-4 py-12 sm:px-6 lg:grid-cols-[0.9fr_1.1fr] lg:px-8">
          <div>
            <p className="text-sm font-800 uppercase text-mint-700">Beneficios</p>
            <h2 className="mt-2 text-3xl font-800 text-slate-950">Todo lo necesario para operar desde el dia uno</h2>
            <p className="mt-3 text-base leading-7 text-slate-600">Tu equipo vende, prepara y reparte con una misma vista de trabajo durante la prueba gratis.</p>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            {[
              'Muestra tu catalogo siempre actualizado',
              'Llega a mas clientes con tu tienda abierta 24/7',
              'Toma pedidos sin llamadas perdidas',
              'Controla stock antes de confirmar',
              'Organiza entregas por chofer y vehiculo',
            ].map((benefit) => (
              <BenefitItem key={benefit} text={benefit} />
            ))}
          </div>
        </div>
      </section>

      <section className="mx-auto grid max-w-7xl gap-8 px-4 py-12 sm:px-6 lg:px-8">
        <div>
          <p className="text-sm font-800 uppercase text-brand-700">Incluido en {primaryPlanName}</p>
          <h2 className="mt-2 text-3xl font-800 text-slate-950">Una oferta simple para validar tu operacion</h2>
        </div>
        <div className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-soft">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[680px] text-left text-sm">
              <thead className="bg-slate-100 text-xs uppercase text-slate-600">
                <tr>
                  <th className="px-4 py-3">Area</th>
                  <th className="px-4 py-3">Incluye</th>
                  <th className="px-4 py-3">Resultado</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                <CompareRow area="Ventas" includes="Catalogo online, clientes y pedidos" result="Tu cartera compra sin depender de llamadas." />
                <CompareRow area="Operacion" includes="Stock, listas de precios, descuentos y reportes" result="El equipo confirma con datos actualizados." />
                <CompareRow area="Logistica" includes="Choferes, vehiculos y ruteo automatico" result="Las entregas salen ordenadas por recorrido." />
                <CompareRow area="Crecimiento" includes="Preparado para integraciones ERP" result="La prueba no limita tu proxima etapa." />
              </tbody>
            </table>
          </div>
        </div>
      </section>

      <section className="bg-mint-50">
        <div className="mx-auto grid max-w-7xl gap-6 px-4 py-12 sm:px-6 lg:grid-cols-3 lg:px-8">
          {[
            ['Mayorista Norte', 'Antes perdiamos pedidos por WhatsApp. Ahora cada comercio compra cuando quiere.'],
            ['Distribuidora Ruta 8', 'El equipo prepara mas rapido y los choferes salen con entregas ordenadas.'],
            ['Almacenes Unidos', 'Encontramos productos y precios sin pedir listas nuevas cada semana.'],
          ].map(([name, quote]) => (
            <blockquote key={name} className="rounded-lg border border-emerald-100 bg-white p-5 shadow-soft">
              <p className="text-base leading-7 text-slate-700">"{quote}"</p>
              <footer className="mt-4 font-800 text-slate-950">{name}</footer>
            </blockquote>
          ))}
        </div>
      </section>

      <section className="mx-auto grid max-w-4xl gap-4 px-4 py-12 sm:px-6 lg:px-8">
        <h2 className="text-3xl font-800 text-slate-950">Preguntas frecuentes</h2>
        <FaqItem question="La prueba es gratis?" answer="Si. Las nuevas distribuidoras tienen 60 dias de prueba totalmente gratis en MaxiGestion." />
        <FaqItem question="Tengo que elegir entre varios planes?" answer="No. Para empezar dejamos un solo plan con las funciones clave para vender, preparar y repartir." />
        <FaqItem question="Que pasa despues de los 60 dias?" answer="Te avisamos para continuar con la suscripcion mensual del mismo plan." />
      </section>

      <section className="bg-brand-700">
        <div className="mx-auto flex max-w-7xl flex-col gap-4 px-4 py-10 text-white sm:px-6 lg:flex-row lg:items-center lg:justify-between lg:px-8">
          <div>
            <h2 className="text-3xl font-800">Empeza 60 dias gratis con {primaryPlanName}.</h2>
            <p className="mt-2 text-brand-50">Primero completas tus datos y despues te guiamos para dejar tu cuenta lista.</p>
          </div>
          <a className="inline-flex min-h-12 items-center justify-center rounded-md bg-white px-5 font-800 text-brand-700 transition hover:bg-brand-50" href="#planes">
            Empezar prueba
          </a>
        </div>
      </section>
    </main>
  )
}

function PlanCard({
  plan,
  highlighted,
  loading,
  activeDistributor,
  requiresSignup,
  onSelect,
}: {
  plan: Plan
  highlighted: boolean
  loading: boolean
  activeDistributor: boolean
  requiresSignup: boolean
  onSelect: (plan: Plan) => Promise<void>
}) {
  const benefits = plan.features?.length
    ? plan.features
    : plan.description
        .split('.')
        .map((benefit) => benefit.trim())
        .filter(Boolean)
  const featured = plan.is_featured || highlighted
  const unavailable = !plan.mp_subscription_url || !plan.mp_preapproval_plan_id
  const trialDays = plan.trial_days ?? 0
  const isDisabled = loading || (!activeDistributor && unavailable)
  const buttonText = activeDistributor
    ? 'Ver mi plan'
    : requiresSignup
      ? 'Crear cuenta y probar gratis'
      : loading
        ? 'Abriendo activacion...'
        : unavailable
          ? 'Plan no disponible'
          : trialDays > 0
            ? 'Empezar prueba gratis'
            : 'Elegir plan'

  return (
    <article
      className={`relative rounded-lg border bg-white p-5 shadow-soft ${featured ? 'border-mint-500 ring-2 ring-mint-500' : 'border-slate-200'}`}
    >
      {featured && <p className="mb-4 w-fit rounded-md bg-mint-500 px-3 py-1 text-xs font-800 uppercase text-white">{trialDays > 0 ? `${trialDays} dias gratis` : highlighted ? 'Plan sugerido' : 'Mas elegido'}</p>}
      <h3 className="text-2xl font-800 text-slate-950">{plan.name}</h3>
      <p className="mt-2 min-h-12 text-sm leading-6 text-slate-600">{plan.description}</p>
      {trialDays > 0 && (
        <div className="mt-5 rounded-lg border border-mint-200 bg-mint-50 p-4">
          <p className="text-sm font-800 text-mint-900">{trialDays} dias de prueba totalmente gratis</p>
          <p className="mt-1 text-xs leading-5 text-mint-800">La oferta aplica a nuevas distribuidoras que crean su cuenta.</p>
        </div>
      )}
      <p className="mt-5 text-3xl font-800 text-slate-950">
        {formatPrice(plan.price)}
        <span className="text-sm font-700 text-slate-500"> / mes</span>
      </p>
      {trialDays > 0 && <p className="mt-1 text-xs font-800 uppercase text-slate-500">Despues de la prueba</p>}
      <button
        className={`mt-5 min-h-12 w-full rounded-md px-4 font-800 transition ${
          featured ? 'bg-mint-500 text-white hover:bg-mint-700' : 'bg-brand-600 text-white hover:bg-brand-700'
        } disabled:cursor-not-allowed disabled:opacity-50`}
        type="button"
        disabled={isDisabled}
        onClick={() => void onSelect(plan)}
      >
        {buttonText}
      </button>
      <p className="mt-3 text-xs leading-5 text-slate-500">
        {activeDistributor
          ? 'Tu cuenta ya esta lista. Podes revisar tu plan desde el panel.'
          : requiresSignup
            ? 'Primero te pedimos unos datos basicos y reservamos la prueba gratis.'
            : 'Guardamos tu eleccion y abrimos la activacion del plan.'}
      </p>
      <ul className="mt-5 grid gap-3 text-sm text-slate-700">
        {benefits.map((benefit) => (
          <li key={benefit} className="flex gap-2">
            <CheckIcon />
            <span>{benefit.trim()}</span>
          </li>
        ))}
      </ul>
    </article>
  )
}

function HeroStat({ value, label }: { value: string; label: string }) {
  return (
    <div className="rounded-lg border border-white/25 bg-white/10 p-4 text-white backdrop-blur-sm">
      <p className="text-2xl font-800">{value}</p>
      <p className="mt-1 text-sm text-emerald-50">{label}</p>
    </div>
  )
}

function BenefitItem({ text }: { text: string }) {
  return (
    <div className="flex gap-3 rounded-lg border border-slate-200 bg-slate-50 p-4">
      <CheckIcon />
      <p className="font-800 text-slate-800">{text}</p>
    </div>
  )
}

function CompareRow({ area, includes, result }: { area: string; includes: string; result: string }) {
  return (
    <tr>
      <td className="px-4 py-4 font-800 text-slate-950">{area}</td>
      <td className="px-4 py-4 text-slate-700">{includes}</td>
      <td className="px-4 py-4 text-slate-700">{result}</td>
    </tr>
  )
}

function FaqItem({ question, answer }: { question: string; answer: string }) {
  return (
    <details className="rounded-lg border border-slate-200 bg-white p-5 shadow-soft">
      <summary className="cursor-pointer font-800 text-slate-950">{question}</summary>
      <p className="mt-3 leading-7 text-slate-600">{answer}</p>
    </details>
  )
}

function CheckIcon() {
  return (
    <svg className="mt-0.5 h-5 w-5 flex-none text-mint-700" viewBox="0 0 20 20" fill="none" aria-hidden="true">
      <path d="M4 10.5 8.1 14 16 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function formatPrice(value: string) {
  return `$${Number(value).toLocaleString('es-AR')}`
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
