import { Link } from 'react-router-dom'

const purchaseHighlights = [
  { value: '24/7', label: 'catalogos disponibles para reponer cuando tu negocio lo necesita' },
  { value: 'Stock visible', label: 'precios, SKU y disponibilidad claros antes de confirmar' },
  { value: 'Tracking', label: 'seguimiento del pedido y la entrega desde la misma cuenta' },
]

const customerBenefits = [
  'Explora distribuidoras activas por zona y direccion',
  'Compara articulos sin pedir listas nuevas cada semana',
  'Arma pedidos con datos de stock y precio actualizados',
  'Consulta el estado de cada orden en un solo flujo',
  'Mantiene un historial simple para volver a comprar',
]

const workflowSteps = [
  {
    title: 'Elige una distribuidora',
    text: 'Abre el directorio, revisa la zona y entra a su catalogo desde el mismo flujo.',
  },
  {
    title: 'Carga el pedido',
    text: 'Selecciona articulos con stock visible, suma al carrito y confirma sin mensajes cruzados.',
  },
  {
    title: 'Sigue la entrega',
    text: 'Consulta estados, tracking y detalles del pedido desde tu cuenta de cliente.',
  },
]

const operatingRules = [
  'El alta online queda reservada para clientes que quieren comprar.',
  'Las distribuidoras ahora abren una cuenta basica y luego eligen plan antes de activarse.',
  'Los choferes los da de alta cada distribuidora desde su propio dashboard.',
]

export function LandingPage() {
  return (
    <main className="min-h-dvh bg-slate-50 text-slate-950">
      <section className="relative isolate min-h-[72dvh] overflow-hidden">
        <img
          className="absolute inset-0 h-full w-full object-cover"
          src="https://images.unsplash.com/photo-1542838132-92c53300491e?auto=format&fit=crop&w=1800&q=80"
          alt="Gondola de supermercado lista para reposicion"
        />
        <div className="absolute inset-0 bg-emerald-950/72" />
        <nav className="relative z-10 mx-auto flex max-w-7xl items-center justify-between px-4 py-5 sm:px-6 lg:px-8">
          <Link className="text-lg font-800 text-white" to="/">
            DistroMaxi
          </Link>
          <div className="flex flex-wrap items-center gap-2">
            <Link className="inline-flex min-h-11 items-center rounded-md px-3 text-sm font-800 text-white transition hover:bg-white/10" to="/planes">
              Soy distribuidora
            </Link>
            <Link className="inline-flex min-h-11 items-center rounded-md px-3 text-sm font-800 text-white transition hover:bg-white/10" to="/login">
              Ingresar
            </Link>
            <Link className="inline-flex min-h-11 items-center rounded-md bg-white px-4 text-sm font-800 text-emerald-950 transition hover:bg-emerald-50" to="/register">
              Crear cuenta cliente
            </Link>
          </div>
        </nav>

        <div className="relative z-10 mx-auto grid max-w-7xl gap-8 px-4 pb-12 pt-10 sm:px-6 lg:grid-cols-[1fr_0.8fr] lg:px-8 lg:pt-16">
          <div className="max-w-4xl">
            <p className="w-fit rounded-md bg-amber-300 px-3 py-2 text-sm font-800 text-slate-950">Landing principal para clientes</p>
            <h1 className="mt-5 text-4xl font-800 leading-tight text-white sm:text-5xl lg:text-6xl">
              Hace tus pedidos a distribuidoras desde un solo lugar.
            </h1>
            <p className="mt-5 max-w-2xl text-lg leading-8 text-emerald-50">
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
            <p className="mt-4 max-w-2xl text-sm leading-6 text-emerald-100">
              Si eres distribuidora, entra primero a la pantalla comercial y desde ahi pasas al alta basica antes del
              checkout.
            </p>
          </div>

          <div className="grid content-start gap-4 lg:pt-12">
            <div className="rounded-lg border border-white/20 bg-white/10 p-5 text-white backdrop-blur-sm">
              <p className="text-sm font-800 uppercase tracking-[0.18em] text-emerald-100">Compra mayorista</p>
              <p className="mt-3 text-2xl font-800 leading-tight">Menos mensajes sueltos. Mas reposicion con criterio.</p>
              <p className="mt-3 text-sm leading-7 text-emerald-50">
                Consulta proveedores, arma el carrito y haz seguimiento del pedido desde una experiencia ordenada.
              </p>
            </div>
            <div className="rounded-lg border border-white/20 bg-slate-950/25 p-5 text-white">
              <p className="text-sm font-800 uppercase tracking-[0.18em] text-emerald-100">Acceso distribuidoras</p>
              <p className="mt-3 text-lg font-800 leading-8">La propuesta comercial actual sigue disponible en /planes para vender con DistroMaxi.</p>
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
              La portada ahora habla primero con el cliente y conserva la misma identidad visual de la experiencia para
              distribuidoras.
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
              Clientes, distribuidoras y choferes siguen circuitos distintos para no mezclar compra, suscripcion y
              operacion.
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
        <FaqItem question="La cuenta online es para clientes o distribuidoras?" answer="Clientes se registran aca. Las distribuidoras entran por /planes, crean su cuenta basica y activan despues con la suscripcion." />
        <FaqItem question="Los choferes tambien se registran desde esta landing?" answer="No. Cada distribuidora crea sus choferes desde su propio panel." />
        <FaqItem question="Si quiero vender con DistroMaxi, a donde entro?" answer="Usa el acceso a /planes. Desde esa pantalla revisas planes, creas la cuenta distribuidora y sigues al checkout." />
      </section>

      <section className="bg-brand-700">
        <div className="mx-auto flex max-w-7xl flex-col gap-4 px-4 py-10 text-white sm:px-6 lg:flex-row lg:items-center lg:justify-between lg:px-8">
          <div>
            <h2 className="text-3xl font-800">Crea tu cuenta y empieza a comprar con un flujo pensado para clientes.</h2>
            <p className="mt-2 text-brand-50">La experiencia para distribuidoras sigue separada para no mezclar onboarding comercial con compra.</p>
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
