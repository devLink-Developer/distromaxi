import { Link } from 'react-router-dom'

const purchaseHighlights = [
  { value: '24/7', label: 'catalogos listos para comprar cuando tu negocio lo necesita' },
  { value: 'Stock al dia', label: 'precios y disponibilidad claros antes de confirmar' },
  { value: 'Seguimiento', label: 'mira el estado del pedido y de la entrega desde la misma cuenta' },
]

const customerBenefits = [
  'Explora distribuidoras activas por zona y direccion',
  'Compara productos sin pedir listas nuevas cada semana',
  'Arma pedidos con datos de stock y precio actualizados',
  'Consulta el estado de cada pedido en un solo lugar',
  'Guarda un historial simple para volver a comprar',
]

const workflowSteps = [
  {
    title: 'Elige una distribuidora',
    text: 'Entra al directorio, mira la zona y abre el catalogo de la distribuidora que te conviene.',
  },
  {
    title: 'Arma tu pedido',
    text: 'Suma productos al carrito con stock visible y confirma sin depender de mensajes sueltos.',
  },
  {
    title: 'Segui la entrega',
    text: 'Revisa el estado del pedido y de la entrega desde tu cuenta, sin salir de DistroMaxi.',
  },
]

const operatingRules = [
  'La cuenta online esta pensada para clientes que quieren comprar.',
  'Las distribuidoras crean su cuenta, eligen un plan y despues ya pueden empezar a vender.',
  'Cada distribuidora carga a sus choferes desde su propio panel.',
]

export function LandingPage() {
  return (
    <main className="min-h-dvh bg-slate-50 text-slate-950">
      <section className="relative isolate min-h-[72dvh] overflow-hidden">
        <img
          className="absolute inset-0 h-full w-full object-cover"
          src="https://images.unsplash.com/photo-1586528116311-ad8dd3c8310d?auto=format&fit=crop&w=1800&q=80"
          alt="Centro de distribucion con pedidos listos para despacho"
        />
        <div className="absolute inset-0 bg-emerald-950/70" />
        <nav className="relative z-10 mx-auto max-w-7xl px-4 py-5 sm:px-6 lg:px-8">
          <div className="grid gap-3 rounded-[1.5rem] border border-white/15 bg-slate-950/20 p-3 backdrop-blur-sm sm:flex sm:items-center sm:justify-between sm:rounded-none sm:border-none sm:bg-transparent sm:p-0 sm:backdrop-blur-0">
            <Link className="text-xl font-800 text-white sm:text-lg" to="/">
              DistroMaxi
            </Link>
            <div className="grid grid-cols-2 gap-2 sm:flex sm:items-center sm:gap-2">
              <Link
                className="inline-flex min-h-11 items-center justify-center rounded-xl border border-white/20 bg-white/10 px-3 text-sm font-800 text-white transition hover:bg-white/15 sm:rounded-md sm:border-transparent sm:bg-transparent sm:px-3"
                to="/planes"
              >
                Soy distribuidora
              </Link>
              <Link
                className="inline-flex min-h-11 items-center justify-center rounded-xl border border-white/20 bg-white/10 px-3 text-sm font-800 text-white transition hover:bg-white/15 sm:rounded-md sm:border-transparent sm:bg-transparent sm:px-3"
                to="/login"
              >
                Ingresar
              </Link>
              <Link
                className="col-span-2 inline-flex min-h-11 items-center justify-center rounded-xl bg-white px-4 text-sm font-800 text-emerald-950 transition hover:bg-emerald-50 sm:col-span-1 sm:rounded-md"
                to="/register"
              >
                Crear cuenta cliente
              </Link>
            </div>
          </div>
        </nav>

        <div className="relative z-10 mx-auto grid max-w-7xl gap-8 px-4 pb-12 pt-10 sm:px-6 lg:grid-cols-[1fr_0.8fr] lg:px-8 lg:pt-16">
          <div className="max-w-4xl">
            <p className="w-fit rounded-md bg-amber-300 px-3 py-2 text-sm font-800 text-slate-950">Para clientes</p>
            <h1 className="mt-5 text-4xl font-800 leading-tight text-white drop-shadow-[0_10px_26px_rgba(0,0,0,0.4)] sm:text-5xl lg:text-6xl">
              Hace tus pedidos desde un solo lugar.
            </h1>
            <p className="mt-5 max-w-2xl text-lg leading-8 text-emerald-50 drop-shadow-[0_6px_18px_rgba(0,0,0,0.32)]">
              Explora catalogos actualizados, repone stock cuando lo necesitas y sigue cada entrega sin salir de
              DistroMaxi.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link
                className="inline-flex min-h-12 items-center justify-center rounded-md bg-white px-5 font-800 text-emerald-950 transition hover:bg-emerald-50"
                to="/register"
              >
                Abrir cuenta de cliente
              </Link>
              <Link
                className="inline-flex min-h-12 items-center justify-center rounded-md border border-white/35 px-5 font-800 text-white transition hover:bg-white/10"
                to="/planes"
              >
                Quiero vender con DistroMaxi
              </Link>
            </div>
            <p className="mt-4 max-w-2xl text-sm leading-6 text-emerald-100 drop-shadow-[0_4px_12px_rgba(0,0,0,0.28)]">
              Si queres vender con DistroMaxi, entra por la seccion para distribuidoras y segui el alta paso a paso.
            </p>
          </div>

          <div className="grid content-start gap-4 lg:pt-12">
            <div className="rounded-lg border border-white/20 bg-white/10 p-5 text-white backdrop-blur-sm">
              <p className="text-sm font-800 uppercase tracking-[0.18em] text-emerald-100">Compra simple</p>
              <p className="mt-3 text-2xl font-800 leading-tight">Menos mensajes sueltos. Mas reposicion con criterio.</p>
              <p className="mt-3 text-sm leading-7 text-emerald-50">
                Mira proveedores, arma el carrito y segui tu pedido desde una experiencia ordenada.
              </p>
            </div>
            <div className="rounded-lg border border-white/20 bg-white/10 p-5 text-white backdrop-blur-sm">
              <p className="text-sm font-800 uppercase tracking-[0.18em] text-emerald-100">Acceso distribuidoras</p>
              <p className="mt-3 text-lg font-800 leading-8">La seccion para distribuidoras sigue disponible para ver planes y empezar a vender con DistroMaxi.</p>
            </div>
          </div>
        </div>

        <div className="relative z-10 mx-auto grid max-w-7xl gap-3 px-4 pb-12 sm:px-6 lg:grid-cols-3 lg:px-8">
          {purchaseHighlights.map((item) => (
            <HeroStat key={item.label} value={item.value} label={item.label} />
          ))}
        </div>
      </section>

      <section className="bg-white">
        <div className="mx-auto grid max-w-7xl gap-8 px-4 py-12 sm:px-6 lg:grid-cols-[0.9fr_1.1fr] lg:px-8">
          <div>
            <p className="text-sm font-800 uppercase text-mint-700">Beneficios</p>
            <h2 className="mt-2 text-3xl font-800 text-slate-950">Compra mejor, sin salir del flujo operativo.</h2>
            <p className="mt-3 text-base leading-7 text-slate-600">
              Encuentra productos, arma pedidos y revisa entregas desde un mismo lugar, con pasos claros desde el inicio.
            </p>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            {customerBenefits.map((benefit) => (
              <BenefitItem key={benefit} text={benefit} />
            ))}
          </div>
        </div>
      </section>

      <section className="mx-auto grid max-w-7xl gap-8 px-4 py-12 sm:px-6 lg:px-8">
        <div>
          <p className="text-sm font-800 uppercase text-brand-700">Flujo de compra</p>
          <h2 className="mt-2 text-3xl font-800 text-slate-950">Tres pasos para pasar del catalogo a la entrega.</h2>
        </div>
        <div className="grid gap-4 md:grid-cols-3">
          {workflowSteps.map((step, index) => (
            <article key={step.title} className="rounded-lg border border-slate-200 bg-white p-5 shadow-soft">
              <p className="text-sm font-800 uppercase text-brand-700">Paso 0{index + 1}</p>
              <h3 className="mt-3 text-2xl font-800 text-slate-950">{step.title}</h3>
              <p className="mt-3 text-base leading-7 text-slate-600">{step.text}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="bg-mint-50">
        <div className="mx-auto grid max-w-7xl gap-8 px-4 py-12 sm:px-6 lg:grid-cols-[0.95fr_1.05fr] lg:px-8">
          <div>
            <p className="text-sm font-800 uppercase text-mint-700">Reglas de acceso</p>
            <h2 className="mt-2 text-3xl font-800 text-slate-950">Cada tipo de cuenta entra por su propio circuito.</h2>
            <p className="mt-3 text-base leading-7 text-slate-600">
              Clientes, distribuidoras y choferes usan recorridos distintos para que cada uno vea solo lo que necesita.
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              <Link
                className="inline-flex min-h-12 items-center justify-center rounded-md bg-slate-950 px-5 font-800 text-white transition hover:bg-slate-800"
                to="/planes"
              >
                Ir a la pantalla para distribuidoras
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
            {operatingRules.map((rule) => (
              <div key={rule} className="rounded-lg border border-emerald-100 bg-white p-5 shadow-soft">
                <p className="text-base leading-7 text-slate-700">{rule}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="mx-auto grid max-w-4xl gap-4 px-4 py-12 sm:px-6 lg:px-8">
        <h2 className="text-3xl font-800 text-slate-950">Preguntas frecuentes</h2>
        <FaqItem question="La cuenta online es para clientes o distribuidoras?" answer="Aca se registran los clientes. Las distribuidoras tienen su propia seccion para crear la cuenta y elegir un plan." />
        <FaqItem question="Los choferes tambien se registran desde esta pantalla?" answer="No. Cada distribuidora crea sus choferes desde su panel." />
        <FaqItem question="Si quiero vender con DistroMaxi, por donde entro?" answer="Usa el acceso para distribuidoras. Desde ahi ves los planes y empezas el alta." />
      </section>

      <section className="bg-brand-700">
        <div className="mx-auto flex max-w-7xl flex-col gap-4 px-4 py-10 text-white sm:px-6 lg:flex-row lg:items-center lg:justify-between lg:px-8">
          <div>
            <h2 className="text-3xl font-800">Crea tu cuenta y empieza a comprar con un flujo pensado para clientes.</h2>
            <p className="mt-2 text-brand-50">La experiencia para distribuidoras sigue separada para que comprar y vender tengan caminos claros.</p>
          </div>
          <Link className="inline-flex min-h-12 items-center justify-center rounded-md bg-white px-5 font-800 text-brand-700 transition hover:bg-brand-50" to="/register">
            Crear cuenta ahora
          </Link>
        </div>
      </section>
    </main>
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
