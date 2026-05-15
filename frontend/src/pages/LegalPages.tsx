import { Link } from 'react-router-dom'
import type { ReactNode } from 'react'

import { BrandLogo } from '../components/BrandLogo'

const lastUpdated = '15 de mayo de 2026'

export function TermsPage() {
  return (
    <LegalShell title="Terminos y Condiciones">
      <LegalSection title="1. Rol de DistroMaxi">
        DistroMaxi es una plataforma tecnologica cuyo objetivo es conectar distribuidoras con compradores comerciales. DistroMaxi no es vendedor de los productos publicados por las distribuidoras, no interviene como procesador de pagos entre comprador y vendedor y no ejecuta entregas por cuenta propia, salvo que se informe expresamente un servicio adicional por separado.
      </LegalSection>
      <LegalSection title="2. Operaciones entre usuarios">
        Cada compra, precio, descuento, condicion comercial, forma de pago, preparacion, facturacion, garantia, cambio, devolucion y entrega se acuerda directamente entre la distribuidora vendedora y el comprador. La distribuidora es responsable por la informacion de sus productos, disponibilidad, precios, cumplimiento de ofertas, comprobantes fiscales, entrega y atencion de reclamos vinculados con su venta.
      </LegalSection>
      <LegalSection title="3. Pagos y entregas">
        Los pagos se realizan fuera de DistroMaxi o mediante los medios que las partes acuerden entre si. DistroMaxi no custodia fondos de compraventas entre usuarios, no garantiza la cobranza ni el pago y no responde por incumplimientos de pago, contracargos, demoras, faltantes, roturas, fallas de entrega o diferencias de mercaderia atribuibles al vendedor, comprador, transportista o tercero interviniente, en la medida permitida por la normativa aplicable.
      </LegalSection>
      <LegalSection title="4. Obligaciones de las distribuidoras">
        Las distribuidoras deben publicar informacion veraz, suficiente y actualizada; respetar precios y condiciones ofrecidas; contar con habilitaciones y capacidad para vender; cumplir normas fiscales, sanitarias, comerciales, laborales, de defensa del consumidor cuando correspondan y cualquier regulacion aplicable a sus productos y zonas de entrega.
      </LegalSection>
      <LegalSection title="5. Obligaciones de los compradores">
        Los compradores deben cargar datos correctos, revisar productos y condiciones antes de confirmar pedidos, coordinar pagos y recepcion con la distribuidora, y usar la plataforma de buena fe, con fines comerciales licitos.
      </LegalSection>
      <LegalSection title="6. Limitacion de responsabilidad">
        DistroMaxi responde por la prestacion de su servicio tecnologico conforme a estas condiciones y a la ley aplicable. Ninguna clausula limita derechos irrenunciables que pudieran corresponder por normas de orden publico. Fuera de esos supuestos, DistroMaxi no asume responsabilidad por acuerdos, pagos, entregas, calidad, cantidad, estado, aptitud, garantia o cumplimiento de productos vendidos por las distribuidoras.
      </LegalSection>
      <LegalSection title="7. Suspension o baja">
        DistroMaxi puede suspender o limitar cuentas que incumplan estas condiciones, publiquen informacion falsa, afecten la seguridad de la plataforma, usen datos de terceros sin autorizacion o generen riesgos operativos o legales para otros usuarios.
      </LegalSection>
      <LegalSection title="8. Cambios">
        DistroMaxi puede actualizar estos terminos. Si el cambio es relevante, se informara por la plataforma o por medios de contacto registrados. El uso posterior de la plataforma implica aceptacion de la version vigente.
      </LegalSection>
      <LegalSection title="9. Ley aplicable">
        Estas condiciones se rigen por las leyes de la Republica Argentina. Toda interpretacion debe hacerse respetando normas imperativas aplicables, incluyendo, cuando corresponda, defensa del consumidor, contratos, comercio electronico y proteccion de datos personales.
      </LegalSection>
    </LegalShell>
  )
}

export function UsePoliciesPage() {
  return (
    <LegalShell title="Politicas de Uso">
      <LegalSection title="1. Uso permitido">
        La plataforma debe utilizarse para conectar compradores comerciales con distribuidoras, consultar catalogos, gestionar pedidos, organizar operaciones y mantener comunicaciones relacionadas con la actividad comercial.
      </LegalSection>
      <LegalSection title="2. Contenido y publicaciones">
        No se permite publicar informacion falsa, enganosa, discriminatoria, ilegal, ofensiva o que infrinja derechos de terceros. Las distribuidoras son responsables por imagenes, descripciones, precios, stock, condiciones de venta y documentacion comercial que carguen.
      </LegalSection>
      <LegalSection title="3. Comunicaciones y opiniones">
        El canal "Tu opinion nos importa" debe usarse para sugerencias, consultas o problemas vinculados con DistroMaxi. No reemplaza reclamos comerciales contra una distribuidora ni reclamos de pago o entrega entre las partes, aunque puede ayudarnos a detectar mejoras o incumplimientos de uso de la plataforma.
      </LegalSection>
      <LegalSection title="4. Datos personales">
        Los usuarios deben cargar datos propios, exactos y actualizados. DistroMaxi utiliza los datos necesarios para crear cuentas, operar la plataforma, conectar compradores y distribuidoras, brindar soporte, seguridad y cumplir obligaciones legales. Los usuarios pueden solicitar acceso, rectificacion o actualizacion de sus datos por los canales de contacto disponibles.
      </LegalSection>
      <LegalSection title="5. Seguridad">
        Cada usuario debe proteger sus credenciales y notificar accesos no autorizados. Se prohibe intentar vulnerar la plataforma, extraer datos masivamente, automatizar consultas sin autorizacion o interferir con la operacion normal del servicio.
      </LegalSection>
      <LegalSection title="6. Conductas prohibidas">
        Se prohibe usar DistroMaxi para fraude, lavado de activos, venta de productos prohibidos, suplantacion de identidad, hostigamiento, spam, manipulacion de precios, captacion de datos sin autorizacion o cualquier actividad contraria a la ley argentina.
      </LegalSection>
      <LegalSection title="7. Medidas ante incumplimientos">
        DistroMaxi puede moderar contenido, requerir correcciones, limitar funcionalidades, suspender cuentas o conservar evidencias internas cuando detecte riesgos, incumplimientos o pedidos de autoridad competente.
      </LegalSection>
    </LegalShell>
  )
}

function LegalShell({ title, children }: { title: string; children: ReactNode }) {
  return (
    <main className="min-h-dvh bg-slate-50 text-slate-950">
      <nav className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-4 px-4 py-4 sm:px-6">
          <BrandLogo className="justify-start" dark size="nav" to="/" />
          <Link className="min-h-11 rounded-md border border-slate-200 px-4 py-3 text-sm font-800 text-slate-700 transition hover:bg-slate-50" to="/">
            Ir al inicio
          </Link>
        </div>
      </nav>
      <article className="mx-auto grid max-w-5xl gap-6 px-4 py-8 sm:px-6">
        <header className="rounded-lg border border-slate-200 bg-white p-6 shadow-soft">
          <p className="text-sm font-800 uppercase text-brand-700">DistroMaxi</p>
          <h1 className="mt-2 text-3xl font-800 text-slate-950">{title}</h1>
          <p className="mt-2 text-sm leading-6 text-slate-600">Ultima actualizacion: {lastUpdated}</p>
        </header>
        <div className="grid gap-4 rounded-lg border border-slate-200 bg-white p-6 shadow-soft">
          {children}
        </div>
      </article>
    </main>
  )
}

function LegalSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="grid gap-2">
      <h2 className="text-lg font-800 text-slate-950">{title}</h2>
      <p className="text-sm leading-7 text-slate-700">{children}</p>
    </section>
  )
}
