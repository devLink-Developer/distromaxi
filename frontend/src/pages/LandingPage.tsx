import { Link } from 'react-router-dom'

import { BrandLogo } from '../components/BrandLogo'
import { CertificateTrustLogo } from '../components/CertificateTrustLogo'

const buyerSignals = [
  { value: 'Compra mayorista', label: 'para comercios que quieren abastecerse mejor' },
  { value: 'Proveedores locales', label: 'distribuidoras cerca de tu zona y de tu rubro' },
  { value: 'Sitio seguro', label: 'experiencia protegida para comprar con confianza' },
]

const buyerReasons = [
  'Mayoristas confiables en una sola marca digital',
  'Compras grandes sin conversaciones dispersas',
  'Abastecimiento para kioscos, almacenes, mercados y bares',
  'Una experiencia pensada para quienes compran todos los dias',
]

const marketMoments = [
  {
    title: 'Compra para vender mejor',
    text: 'Tu comercio necesita respaldo mayorista, buenos precios y proveedores que lleguen a tiempo.',
  },
  {
    title: 'Mayoristas cerca',
    text: 'El comercio local merece una red de distribuidoras preparada para abastecer todos los dias.',
  },
  {
    title: 'Compra con respaldo',
    text: 'Una marca digital clara, segura y enfocada en el crecimiento de compradores comerciales.',
  },
]

const distributorReasons = [
  {
    title: 'Mas presencia',
    text: 'Tu distribuidora gana lugar frente a comercios con necesidad real de compra.',
  },
  {
    title: 'Venta mayorista digital',
    text: 'Converti tu propuesta comercial en una vidriera simple, seria y disponible.',
  },
  {
    title: 'Un canal propio',
    text: 'Acompana tu fuerza de venta con una experiencia online preparada para crecer.',
  },
]

export function LandingPage() {
  return (
    <main className="min-h-dvh bg-slate-50 text-slate-950">
      <section className="relative isolate min-h-[72dvh] overflow-hidden">
        <img
          className="absolute inset-0 h-full w-full object-cover"
          src="https://images.unsplash.com/photo-1586528116311-ad8dd3c8310d?auto=format&fit=crop&w=1800&q=80"
          alt="Centro de distribucion mayorista con mercaderia lista"
        />
        <div className="absolute inset-0 bg-emerald-950/70" />
        <nav className="relative z-10 border-b border-slate-200 bg-white">
          <div className="mx-auto grid max-w-7xl gap-3 px-4 py-4 sm:px-6 lg:flex lg:items-center lg:justify-between lg:px-8">
            <BrandLogo className="justify-start" dark size="nav" to="/" />
            <div className="grid grid-cols-2 gap-2 sm:flex sm:items-center sm:gap-2">
              <Link
                className="inline-flex min-h-11 items-center justify-center rounded-xl border border-slate-200 bg-slate-100 px-3 text-sm font-800 text-slate-800 transition hover:bg-slate-200 hover:text-slate-950 sm:rounded-md"
                to="/planes"
              >
                Vender en DistroMaxi
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
                Empezar a comprar
              </Link>
            </div>
          </div>
        </nav>

        <div className="relative z-10 mx-auto grid max-w-7xl gap-8 px-4 pb-12 pt-10 sm:px-6 lg:grid-cols-[1fr_0.8fr] lg:px-8 lg:pt-16">
          <div className="max-w-4xl">
            <p className="w-fit rounded-md bg-amber-300 px-3 py-2 text-sm font-800 text-slate-950">
              Para compradores mayoristas
            </p>
            <h1 className="mt-5 text-5xl font-800 leading-tight text-white drop-shadow-[0_10px_26px_rgba(0,0,0,0.4)] sm:text-6xl lg:text-7xl">
              DistroMaxi
            </h1>
            <h2 className="mt-4 max-w-3xl text-3xl font-800 leading-tight text-white drop-shadow-[0_10px_26px_rgba(0,0,0,0.35)] sm:text-4xl lg:text-5xl">
              Compra mayorista simple para tu negocio.
            </h2>
            <p className="mt-5 max-w-2xl text-lg leading-8 text-emerald-50 drop-shadow-[0_6px_18px_rgba(0,0,0,0.32)]">
              Compra al por mayor con respaldo, cercania y confianza. DistroMaxi pone a tu negocio frente a una red de
              distribuidoras listas para abastecerte.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link
                className="inline-flex min-h-12 items-center justify-center rounded-md bg-white px-5 font-800 text-emerald-950 transition hover:bg-emerald-50"
                to="/register"
              >
                Empezar a comprar
              </Link>
              <Link
                className="inline-flex min-h-12 items-center justify-center rounded-md border border-white/35 px-5 font-800 text-white transition hover:bg-white/10"
                to="/planes"
              >
                Quiero vender con DistroMaxi
              </Link>
            </div>
            <p className="mt-4 max-w-xl text-sm leading-6 text-emerald-100 drop-shadow-[0_4px_12px_rgba(0,0,0,0.28)]">
              Primero compradores. Tambien distribuidoras que quieren vender mejor.
            </p>
          </div>

          <div className="grid content-start gap-4 lg:pt-12">
            <div className="rounded-lg border border-white/20 bg-white/10 p-5 text-white backdrop-blur-sm">
              <p className="text-sm font-800 uppercase tracking-[0.18em] text-emerald-100">Comprador primero</p>
              <p className="mt-3 text-2xl font-800 leading-tight">Tu proxima compra mayorista empieza aca.</p>
              <p className="mt-3 text-sm leading-7 text-emerald-50">
                Menos friccion, mas respaldo y una red comercial alineada con el ritmo de tu negocio.
              </p>
            </div>
            <div className="rounded-lg border border-white/20 bg-white/10 p-5 text-white backdrop-blur-sm">
              <p className="text-sm font-800 uppercase tracking-[0.18em] text-emerald-100">Distribuidoras</p>
              <p className="mt-3 text-lg font-800 leading-8">
                Un canal digital para llegar a comercios que ya necesitan comprar.
              </p>
            </div>
          </div>
        </div>

        <div className="relative z-10 mx-auto grid max-w-7xl gap-3 px-4 pb-12 sm:px-6 lg:grid-cols-3 lg:px-8">
          {buyerSignals.map((item) => (
            <HeroSignal key={item.label} value={item.value} label={item.label} />
          ))}
        </div>
      </section>

      <section className="bg-white">
        <div className="mx-auto grid max-w-7xl gap-8 px-4 py-14 sm:px-6 lg:grid-cols-[0.9fr_1.1fr] lg:px-8">
          <div>
            <p className="text-sm font-800 uppercase text-mint-700">Para compradores</p>
            <h2 className="mt-2 text-3xl font-800 text-slate-950">
              Comprar al por mayor deberia sentirse claro, cercano y seguro.
            </h2>
            <p className="mt-3 text-base leading-7 text-slate-600">
              Una marca mayorista digital para comprar mejor, con menos ruido y mas confianza.
            </p>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            {buyerReasons.map((reason) => (
              <BenefitItem key={reason} text={reason} />
            ))}
          </div>
        </div>
      </section>

      <section className="mx-auto grid max-w-7xl gap-8 px-4 py-14 sm:px-6 lg:px-8">
        <div className="max-w-3xl">
          <p className="text-sm font-800 uppercase text-brand-700">Compra con respaldo</p>
          <h2 className="mt-2 text-3xl font-800 text-slate-950">Una nueva forma de abastecer tu comercio.</h2>
        </div>
        <div className="grid gap-4 md:grid-cols-3">
          {marketMoments.map((moment) => (
            <article key={moment.title} className="rounded-lg border border-slate-200 bg-white p-5 shadow-soft">
              <h3 className="text-2xl font-800 text-slate-950">{moment.title}</h3>
              <p className="mt-3 text-base leading-7 text-slate-600">{moment.text}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="bg-mint-50">
        <div className="mx-auto grid max-w-7xl gap-8 px-4 py-14 sm:px-6 lg:grid-cols-[0.95fr_1.05fr] lg:px-8">
          <div>
            <p className="text-sm font-800 uppercase text-mint-700">Para distribuidoras</p>
            <h2 className="mt-2 text-3xl font-800 text-slate-950">
              Tu mayorista, frente a compradores listos para abastecerse.
            </h2>
            <p className="mt-3 text-base leading-7 text-slate-600">
              DistroMaxi tambien abre una vidriera comercial para distribuidoras que quieren crecer con compradores
              reales.
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              <Link
                className="inline-flex min-h-12 items-center justify-center rounded-md bg-slate-950 px-5 font-800 text-white transition hover:bg-slate-800"
                to="/planes"
              >
                Ver planes para distribuidoras
              </Link>
              <Link
                className="inline-flex min-h-12 items-center justify-center rounded-md border border-mint-700 px-5 font-800 text-mint-700 transition hover:bg-mint-700 hover:text-white"
                to="/login"
              >
                Ya tengo cuenta
              </Link>
            </div>
          </div>

          <div className="grid gap-4">
            {distributorReasons.map((reason) => (
              <div key={reason.title} className="rounded-lg border border-emerald-100 bg-white p-5 shadow-soft">
                <h3 className="text-xl font-800 text-slate-950">{reason.title}</h3>
                <p className="mt-2 text-base leading-7 text-slate-700">{reason.text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="bg-brand-700">
        <div className="mx-auto grid max-w-7xl gap-6 px-4 py-10 text-white sm:px-6 lg:grid-cols-[1fr_auto] lg:items-center lg:px-8">
          <div>
            <h2 className="text-3xl font-800">Compra mayorista con una marca pensada para tu comercio.</h2>
            <p className="mt-2 text-brand-50">Crea tu cuenta y conecta con distribuidoras listas para venderte.</p>
          </div>
          <div className="flex flex-col items-start gap-4 sm:flex-row sm:items-center lg:flex-col lg:items-end">
            <Link
              className="inline-flex min-h-12 items-center justify-center rounded-md bg-white px-5 font-800 text-brand-700 transition hover:bg-brand-50"
              to="/register"
            >
              Crear cuenta comprador
            </Link>
            <CertificateTrustLogo className="lg:items-end" />
          </div>
        </div>
      </section>
    </main>
  )
}

function HeroSignal({ value, label }: { value: string; label: string }) {
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

function CheckIcon() {
  return (
    <svg className="mt-0.5 h-5 w-5 flex-none text-mint-700" viewBox="0 0 20 20" fill="none" aria-hidden="true">
      <path d="M4 10.5 8.1 14 16 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}
