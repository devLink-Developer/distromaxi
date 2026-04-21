import { Link } from 'react-router-dom'

const purchaseHighlights = [
  { value: '24/7', label: 'catalogos disponibles para reponer cuando tu negocio lo necesita' },
  { value: '1 pedido', label: 'por distribuidora, con precios y stock claros desde el inicio' },
  { value: 'Tracking', label: 'en tiempo real para saber cuando llega cada entrega' },
]

const workflowSteps = [
  {
    title: 'Descubre distribuidoras activas',
    text: 'Revisa zonas, catalogos y condiciones antes de hacer el pedido.',
  },
  {
    title: 'Carga articulos con stock visible',
    text: 'Arma el carrito con informacion actualizada y sin listas desordenadas.',
  },
  {
    title: 'Sigue el pedido hasta la entrega',
    text: 'Consulta estados, notas y tracking desde una sola cuenta de cliente.',
  },
]

const customerReasons = [
  {
    title: 'Comparas mejor',
    text: 'Cada distribuidora muestra su oferta en un entorno ordenado y facil de revisar.',
  },
  {
    title: 'Compras con contexto',
    text: 'Ves disponibilidad, precios, SKU y detalles del producto antes de confirmar.',
  },
  {
    title: 'Operas sin perseguir respuestas',
    text: 'La trazabilidad del pedido y la entrega quedan en la misma plataforma.',
  },
]

const operatingRules = [
  'El alta online queda reservada para clientes que quieren comprar.',
  'Las cuentas de distribuidora las crea el equipo admin desde el panel interno.',
  'Los choferes los da de alta cada distribuidora desde su propio dashboard.',
]

export function LandingPage() {
  return (
    <main className="overflow-hidden bg-[#f7f1e8] text-slate-950">
      <section className="relative isolate overflow-hidden bg-[radial-gradient(circle_at_top_left,_rgba(3,105,161,0.16),_transparent_32%),radial-gradient(circle_at_82%_12%,_rgba(5,150,105,0.18),_transparent_28%),linear-gradient(180deg,#f7f1e8_0%,#ffffff_52%,#eefaf6_100%)]">
        <div className="landing-float-slow absolute left-[-7rem] top-14 h-72 w-72 rounded-full bg-brand-100/80 blur-3xl" />
        <div className="landing-float-fast absolute right-[-5rem] top-24 h-64 w-64 rounded-full bg-mint-500/20 blur-3xl" />

        <nav className="relative z-10 mx-auto flex max-w-7xl items-center justify-between px-4 py-6 sm:px-6 lg:px-8">
          <Link className="text-lg font-800 tracking-[0.08em] text-slate-950" to="/">
            DISTROMAXI
          </Link>
          <div className="flex flex-wrap items-center justify-end gap-2">
            <Link
              className="inline-flex min-h-11 items-center rounded-full px-4 text-sm font-800 text-slate-700 transition hover:bg-white/70"
              to="/planes"
            >
              Soy distribuidora
            </Link>
            <Link
              className="inline-flex min-h-11 items-center rounded-full border border-slate-300/80 bg-white/80 px-4 text-sm font-800 text-slate-800 transition hover:border-brand-500 hover:text-brand-700"
              to="/login"
            >
              Ingresar
            </Link>
            <Link
              className="inline-flex min-h-11 items-center rounded-full bg-slate-950 px-5 text-sm font-800 text-white transition hover:-translate-y-0.5 hover:bg-slate-800"
              to="/register"
            >
              Crear cuenta cliente
            </Link>
          </div>
        </nav>

        <div className="relative z-10 mx-auto grid max-w-7xl gap-14 px-4 pb-16 pt-6 sm:px-6 lg:grid-cols-[0.92fr_1.08fr] lg:px-8 lg:pb-24 lg:pt-10">
          <div className="landing-rise max-w-xl">
            <p className="w-fit rounded-full border border-slate-300/80 bg-white/80 px-4 py-2 text-sm font-800 uppercase tracking-[0.18em] text-brand-700">
              Compra mayorista sin ida y vuelta
            </p>
            <h1 className="mt-6 text-5xl font-800 leading-[1.02] text-slate-950 sm:text-6xl">
              Hace tus pedidos a distribuidoras desde un solo lugar.
            </h1>
            <p className="mt-6 max-w-xl text-lg leading-8 text-slate-600">
              Explora catalogos actualizados, repone stock cuando lo necesitas y sigue cada entrega sin salir de
              DistroMaxi.
            </p>

            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Link
                className="inline-flex min-h-12 items-center justify-center rounded-full bg-brand-600 px-6 text-sm font-800 text-white transition hover:-translate-y-0.5 hover:bg-brand-700"
                to="/register"
              >
                Abrir cuenta de cliente
              </Link>
              <Link
                className="inline-flex min-h-12 items-center justify-center rounded-full border border-slate-300 bg-white px-6 text-sm font-800 text-slate-800 transition hover:border-slate-950 hover:text-slate-950"
                to="/planes"
              >
                Quiero vender con DistroMaxi
              </Link>
            </div>

            <p className="mt-4 text-sm leading-6 text-slate-500">
              El alta online es solo para clientes. Si eres distribuidora, accede a la pantalla comercial pensada para
              vender con nosotros.
            </p>

            <div className="mt-10 grid gap-4 border-t border-slate-200 pt-8 sm:grid-cols-3">
              {purchaseHighlights.map((item) => (
                <div key={item.label} className="group transition hover:-translate-y-1">
                  <p className="text-2xl font-800 text-slate-950">{item.value}</p>
                  <p className="mt-2 text-sm leading-6 text-slate-600">{item.label}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="landing-rise-delay relative">
            <div className="relative overflow-hidden rounded-[2rem] border border-white/80 bg-slate-950 shadow-[0_40px_120px_rgba(15,23,42,0.22)]">
              <img
                className="h-[32rem] w-full object-cover md:h-[38rem]"
                src="https://images.unsplash.com/photo-1542838132-92c53300491e?auto=format&fit=crop&w=1400&q=80"
                alt="Gondola de supermercado lista para reposicion"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/45 to-transparent" />
              <div className="absolute inset-x-6 bottom-6 grid gap-4 text-white sm:inset-x-8 sm:bottom-8">
                <p className="text-xs font-800 uppercase tracking-[0.24em] text-brand-100">Canal clientes</p>
                <div>
                  <p className="text-3xl font-800 leading-tight sm:text-4xl">Menos mensajes, mas reposicion con criterio.</p>
                  <p className="mt-3 max-w-lg text-sm leading-7 text-slate-200 sm:text-base">
                    Consulta proveedores, elige articulos, confirma el pedido y sigue la entrega sin depender de listas
                    sueltas o confirmaciones manuales.
                  </p>
                </div>
              </div>
            </div>

            <div className="absolute -left-3 top-8 hidden w-52 rounded-[1.5rem] border border-slate-200 bg-white/92 p-4 shadow-soft backdrop-blur md:block">
              <p className="text-xs font-800 uppercase tracking-[0.18em] text-slate-500">Antes de comprar</p>
              <p className="mt-3 text-lg font-800 text-slate-950">Filtra por zona y revisa catalogos sin pedir listas por WhatsApp.</p>
            </div>

            <div className="absolute -right-3 bottom-10 hidden w-56 rounded-[1.5rem] border border-white/15 bg-slate-950/88 p-4 text-white shadow-soft backdrop-blur lg:block">
              <p className="text-xs font-800 uppercase tracking-[0.18em] text-brand-100">Despues del checkout</p>
              <p className="mt-3 text-lg font-800">Tracking del pedido y del reparto desde la misma cuenta.</p>
            </div>
          </div>
        </div>
      </section>

      <section className="bg-white">
        <div className="mx-auto grid max-w-7xl gap-12 px-4 py-20 sm:px-6 lg:grid-cols-[0.82fr_1.18fr] lg:px-8">
          <div>
            <p className="text-sm font-800 uppercase tracking-[0.18em] text-brand-700">Flujo simple</p>
            <h2 className="mt-3 text-4xl font-800 leading-tight text-slate-950">Compra con un recorrido claro de principio a fin.</h2>
            <p className="mt-4 max-w-md text-base leading-7 text-slate-600">
              La experiencia principal ahora esta pensada para el cliente que necesita reponer rapido, comparar mejor y
              saber en que estado esta cada pedido.
            </p>
          </div>

          <div className="grid gap-6">
            {workflowSteps.map((step, index) => (
              <article
                key={step.title}
                className="group grid gap-4 border-b border-slate-200 pb-6 transition duration-300 hover:border-brand-300 hover:translate-x-1 sm:grid-cols-[auto_1fr]"
              >
                <span className="text-5xl font-800 leading-none text-slate-200 transition group-hover:text-brand-600">
                  0{index + 1}
                </span>
                <div>
                  <h3 className="text-2xl font-800 text-slate-950">{step.title}</h3>
                  <p className="mt-3 max-w-2xl text-base leading-7 text-slate-600">{step.text}</p>
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="bg-slate-950 text-white">
        <div className="mx-auto grid max-w-7xl gap-10 px-4 py-20 sm:px-6 lg:grid-cols-[1.05fr_0.95fr] lg:px-8">
          <div className="relative overflow-hidden rounded-[2rem] border border-white/10">
            <img
              className="h-full min-h-[26rem] w-full object-cover"
              src="https://images.unsplash.com/photo-1586528116311-ad8dd3c8310d?auto=format&fit=crop&w=1400&q=80"
              alt="Centro logistico con pedidos preparados para entregar"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/40 to-transparent" />
            <div className="absolute inset-x-6 bottom-6 sm:inset-x-8 sm:bottom-8">
              <p className="text-xs font-800 uppercase tracking-[0.2em] text-brand-100">Operacion visible</p>
              <p className="mt-3 max-w-lg text-3xl font-800 leading-tight">El pedido no termina al confirmar: tambien acompanias la entrega.</p>
            </div>
          </div>

          <div className="grid content-start gap-8">
            <div>
              <p className="text-sm font-800 uppercase tracking-[0.18em] text-brand-100">Valor para clientes</p>
              <h2 className="mt-3 text-4xl font-800 leading-tight text-white">Todo lo necesario para comprar con menos friccion.</h2>
              <p className="mt-4 text-base leading-7 text-slate-300">
                DistroMaxi deja de hablarle primero a la distribuidora y pasa a resolver la necesidad del negocio que
                compra.
              </p>
            </div>

            <div className="grid gap-5">
              {customerReasons.map((reason) => (
                <article key={reason.title} className="border-b border-white/10 pb-5">
                  <h3 className="text-2xl font-800 text-white">{reason.title}</h3>
                  <p className="mt-3 text-base leading-7 text-slate-300">{reason.text}</p>
                </article>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="bg-mint-50">
        <div className="mx-auto grid max-w-7xl gap-12 px-4 py-20 sm:px-6 lg:grid-cols-[0.95fr_1.05fr] lg:px-8">
          <div>
            <p className="text-sm font-800 uppercase tracking-[0.18em] text-mint-700">Acceso distribuidoras</p>
            <h2 className="mt-3 text-4xl font-800 leading-tight text-slate-950">Quieres vender con nosotros? Entra por la experiencia comercial actual.</h2>
            <p className="mt-4 max-w-xl text-base leading-7 text-slate-600">
              Mantuvimos la pantalla orientada a distribuidoras para que puedas ver planes y la propuesta comercial sin
              mezclarla con el alta de clientes.
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Link
                className="inline-flex min-h-12 items-center justify-center rounded-full bg-slate-950 px-6 text-sm font-800 text-white transition hover:-translate-y-0.5 hover:bg-slate-800"
                to="/planes"
              >
                Ir a la pantalla para distribuidoras
              </Link>
              <Link
                className="inline-flex min-h-12 items-center justify-center rounded-full border border-mint-700 px-6 text-sm font-800 text-mint-700 transition hover:bg-mint-700 hover:text-white"
                to="/login"
              >
                Ya tengo cuenta
              </Link>
            </div>
          </div>

          <div className="grid gap-4">
            {operatingRules.map((rule) => (
              <div
                key={rule}
                className="rounded-[1.5rem] border border-white/70 bg-white px-5 py-5 text-base leading-7 text-slate-700 shadow-soft transition hover:-translate-y-1"
              >
                {rule}
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="bg-brand-700">
        <div className="mx-auto flex max-w-7xl flex-col gap-5 px-4 py-14 text-white sm:px-6 lg:flex-row lg:items-center lg:justify-between lg:px-8">
          <div>
            <p className="text-sm font-800 uppercase tracking-[0.18em] text-brand-100">Alta clientes</p>
            <h2 className="mt-3 text-4xl font-800 leading-tight">Crea tu cuenta y empieza a comprar con un flujo pensado para clientes.</h2>
          </div>
          <Link
            className="inline-flex min-h-12 items-center justify-center rounded-full bg-white px-6 text-sm font-800 text-brand-700 transition hover:-translate-y-0.5 hover:bg-brand-50"
            to="/register"
          >
            Crear cuenta ahora
          </Link>
        </div>
      </section>
    </main>
  )
}
