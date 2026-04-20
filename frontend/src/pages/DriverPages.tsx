import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'

import { EmptyState } from '../components/EmptyState'
import { StatusBadge } from '../components/StatusBadge'
import { api } from '../services/api'
import { useTrackingStore } from '../stores/trackingStore'
import type { Delivery } from '../types/domain'

export function DriverDeliveriesPage() {
  const [deliveries, setDeliveries] = useState<Delivery[]>([])
  useEffect(() => {
    void api.deliveries().then(setDeliveries)
  }, [])
  if (deliveries.length === 0) return <EmptyState title="Sin entregas asignadas" text="Las entregas aparecerán cuando la distribuidora las asigne." />
  return (
    <section className="grid gap-4">
      <h1 className="text-2xl font-800 text-slate-950">Mis entregas</h1>
      {deliveries.map((delivery) => (
        <article key={delivery.id} className="rounded-lg border border-slate-200 bg-white p-4 shadow-soft">
          <div className="flex flex-wrap justify-between gap-3">
            <div>
              <h2 className="text-lg font-800 text-slate-950">Entrega #{delivery.id}</h2>
              <p className="text-sm text-slate-600">Pedido #{delivery.order} · {delivery.commerce_name}</p>
            </div>
            <StatusBadge status={delivery.status} />
          </div>
          <Link className="mt-4 inline-flex min-h-11 items-center rounded-md bg-brand-600 px-4 font-800 text-white" to={`/driver/deliveries/${delivery.id}`}>
            Abrir tracking
          </Link>
        </article>
      ))}
    </section>
  )
}

export function DriverDeliveryDetailPage() {
  const { id } = useParams()
  const delivery = useTrackingStore((state) => state.delivery)
  const fetchDelivery = useTrackingStore((state) => state.fetchDelivery)
  const sendLocation = useTrackingStore((state) => state.sendLocation)
  const [message, setMessage] = useState('')

  useEffect(() => {
    if (id) void fetchDelivery(id)
  }, [fetchDelivery, id])

  function shareLocation() {
    if (!id || !navigator.geolocation) {
      setMessage('Geolocalización no disponible en este dispositivo.')
      return
    }
    navigator.geolocation.getCurrentPosition(
      (position) => {
        void sendLocation(Number(id), position).then(() => setMessage('Ubicación enviada.'))
      },
      () => setMessage('No se pudo obtener la ubicación. Revisá los permisos del navegador.'),
      { enableHighAccuracy: true, timeout: 10000 },
    )
  }

  if (!delivery) return <EmptyState title="Cargando entrega" text="Consultando datos de ruta y pedido." />
  return (
    <section className="grid gap-5">
      <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-soft">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-2xl font-800 text-slate-950">Entrega #{delivery.id}</h1>
            <p className="mt-1 text-sm text-slate-600">Pedido #{delivery.order} · {delivery.commerce_name}</p>
          </div>
          <StatusBadge status={delivery.status} />
        </div>
        <button className="mt-5 min-h-12 rounded-md bg-brand-600 px-5 font-800 text-white" type="button" onClick={shareLocation}>
          Enviar ubicación actual
        </button>
        {message && <p className="mt-3 rounded-md bg-brand-50 px-3 py-2 text-sm font-800 text-brand-700">{message}</p>}
      </div>
      <TrackingMap delivery={delivery} />
    </section>
  )
}

export function TrackingPage() {
  const { orderId } = useParams()
  const [deliveries, setDeliveries] = useState<Delivery[]>([])
  useEffect(() => {
    void api.deliveries().then((items) => setDeliveries(items.filter((delivery) => String(delivery.order) === orderId)))
  }, [orderId])
  const delivery = deliveries[0]
  if (!delivery) return <EmptyState title="Tracking pendiente" text="La distribuidora todavía no asignó una entrega a este pedido." />
  return (
    <section className="grid gap-5">
      <div>
        <h1 className="text-2xl font-800 text-slate-950">Tracking pedido #{orderId}</h1>
        <p className="mt-2 text-sm text-slate-600">Seguimiento de la entrega en curso.</p>
      </div>
      <TrackingMap delivery={delivery} />
    </section>
  )
}

function TrackingMap({ delivery }: { delivery: Delivery }) {
  const lat = delivery.last_latitude
  const lng = delivery.last_longitude
  const mapUrl = lat && lng ? `https://www.openstreetmap.org/export/embed.html?bbox=${Number(lng) - 0.01}%2C${Number(lat) - 0.01}%2C${Number(lng) + 0.01}%2C${Number(lat) + 0.01}&layer=mapnik&marker=${lat}%2C${lng}` : ''
  return (
    <div className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-soft">
      {mapUrl ? (
        <iframe className="h-80 w-full border-0" title="Mapa de tracking" src={mapUrl} />
      ) : (
        <div className="grid h-80 place-items-center bg-slate-100 p-6 text-center text-sm font-700 text-slate-600">
          Sin ubicación reciente. El chofer debe compartir su posición.
        </div>
      )}
      <div className="grid gap-2 p-4 text-sm text-slate-700">
        <p><strong>Chofer:</strong> {delivery.driver_name}</p>
        <p><strong>Vehículo:</strong> {delivery.vehicle_plate}</p>
        <p><strong>Última ubicación:</strong> {lat && lng ? `${lat}, ${lng}` : 'pendiente'}</p>
        <p><strong>Hora:</strong> {delivery.last_location_at ? new Date(delivery.last_location_at).toLocaleString('es-AR') : 'sin datos'}</p>
      </div>
    </div>
  )
}
