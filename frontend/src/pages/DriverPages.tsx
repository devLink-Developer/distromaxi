import { useEffect, useMemo, useState } from 'react'
import { useParams } from 'react-router-dom'

import { EmptyState } from '../components/EmptyState'
import { StatusBadge } from '../components/StatusBadge'
import { api } from '../services/api'
import { useFeedbackStore } from '../stores/feedbackStore'
import { useTrackingStore } from '../stores/trackingStore'
import type { CurrentRoute, Delivery } from '../types/domain'

export function DriverDeliveriesPage() {
  const sendLocation = useTrackingStore((state) => state.sendLocation)
  const [route, setRoute] = useState<CurrentRoute | null>(null)
  const [loading, setLoading] = useState(true)
  const showSuccess = useFeedbackStore((state) => state.success)
  const showError = useFeedbackStore((state) => state.error)
  const showInfo = useFeedbackStore((state) => state.info)

  async function load() {
    setLoading(true)
    try {
      const current = await api.currentRoute()
      setRoute(current ?? null)
    } catch {
      setRoute(null)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void load()
  }, [])

  const activeStop = useMemo(
    () => route?.stops.find((stop) => stop.status === 'PENDING' || stop.status === 'ARRIVED') ?? null,
    [route],
  )

  function openNavigation() {
    if (!activeStop?.delivery_latitude || !activeStop.delivery_longitude) return
    const url = `https://www.google.com/maps/dir/?api=1&destination=${activeStop.delivery_latitude},${activeStop.delivery_longitude}&travelmode=driving`
    window.open(url, '_blank', 'noopener,noreferrer')
  }

  function shareLocation() {
    if (!activeStop?.delivery_id || !navigator.geolocation) {
      showInfo('No hay una entrega activa con tracking disponible.')
      return
    }
    navigator.geolocation.getCurrentPosition(
      (position) => {
        void sendLocation(activeStop.delivery_id as number, position)
          .then(() => showSuccess('Ubicacion enviada.'))
          .catch(() => showError('No se pudo enviar la ubicacion.'))
      },
      () => showError('No se pudo obtener la ubicacion. Revisa los permisos del navegador.'),
      { enableHighAccuracy: true, timeout: 10000 },
    )
  }

  async function markArrived(stopId: number) {
    try {
      await api.arriveRouteStop(stopId)
      await load()
      showSuccess('Arribo registrado.')
    } catch {
      showError('No se pudo registrar el arribo.')
    }
  }

  async function markDelivered(stopId: number) {
    try {
      await api.deliverRouteStop(stopId)
      await load()
      showSuccess('Entrega registrada.')
    } catch {
      showError('No se pudo registrar la entrega.')
    }
  }

  if (loading) return <EmptyState title="Cargando ruta" text="Consultando la hoja de ruta del dia." />
  if (!route) return <EmptyState title="Sin ruta activa" text="La distribuidora va a ver la secuencia aca cuando la despache." />

  return (
    <section className="grid gap-5">
      <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-soft">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-2xl font-800 text-slate-950">Mi ruta actual</h1>
            <p className="mt-1 text-sm text-slate-600">
              {route.vehicle_plate} · {route.total_stops} paradas · {Number(route.total_distance_km).toLocaleString('es-AR')} km
            </p>
          </div>
          <StatusBadge status={route.route_plan_status} />
        </div>
        <div className="mt-5 flex flex-wrap gap-3">
          <button className="min-h-11 rounded-md bg-brand-600 px-4 font-800 text-white" type="button" onClick={openNavigation} disabled={!activeStop}>
            Abrir navegacion
          </button>
          <button className="min-h-11 rounded-md border border-slate-300 px-4 font-800 text-slate-700" type="button" onClick={shareLocation}>
            Enviar ubicacion actual
          </button>
          <button className="min-h-11 rounded-md border border-slate-300 px-4 font-800 text-slate-700" type="button" onClick={() => void load()}>
            Actualizar
          </button>
        </div>
      </div>

      <div className="grid gap-4">
        {route.stops.map((stop) => {
          const isActive = stop.id === route.active_stop_id
          return (
            <article key={stop.id} className={`rounded-lg border bg-white p-4 shadow-soft ${isActive ? 'border-brand-300 ring-2 ring-brand-100' : 'border-slate-200'}`}>
              <div className="flex flex-wrap justify-between gap-3">
                <div>
                  <h2 className="text-lg font-800 text-slate-950">
                    #{stop.sequence} · {stop.commerce_name}
                  </h2>
                  <p className="text-sm text-slate-600">{stop.delivery_address}</p>
                </div>
                <StatusBadge status={stop.status} />
              </div>
              <p className="mt-3 text-sm text-slate-500">
                ETA {timeOnly(stop.planned_eta)} · ventana {timeOnly(stop.window_start_at)} - {timeOnly(stop.window_end_at)}
              </p>
              <div className="mt-4 flex flex-wrap gap-3">
                <button
                  className="min-h-10 rounded-md border border-slate-300 px-3 text-sm font-800 text-slate-700"
                  type="button"
                  disabled={!stop.delivery_latitude || !stop.delivery_longitude}
                  onClick={() => {
                    if (!stop.delivery_latitude || !stop.delivery_longitude) return
                    window.open(
                      `https://www.google.com/maps/dir/?api=1&destination=${stop.delivery_latitude},${stop.delivery_longitude}&travelmode=driving`,
                      '_blank',
                      'noopener,noreferrer',
                    )
                  }}
                >
                  Abrir navegacion
                </button>
                {stop.status === 'PENDING' && (
                  <button className="min-h-10 rounded-md bg-brand-600 px-3 text-sm font-800 text-white" type="button" onClick={() => void markArrived(stop.id)}>
                    Marcar arribo
                  </button>
                )}
                {stop.status !== 'DELIVERED' && (
                  <button className="min-h-10 rounded-md border border-brand-200 px-3 text-sm font-800 text-brand-700" type="button" onClick={() => void markDelivered(stop.id)}>
                    Marcar entregado
                  </button>
                )}
              </div>
            </article>
          )
        })}
      </div>
    </section>
  )
}

export function DriverDeliveryDetailPage() {
  return <DriverDeliveriesPage />
}

export function TrackingPage() {
  const { orderId } = useParams()
  const [deliveries, setDeliveries] = useState<Delivery[]>([])
  useEffect(() => {
    void api.deliveries().then((items) => setDeliveries(items.filter((delivery) => String(delivery.order) === orderId)))
  }, [orderId])
  const delivery = deliveries[0]
  if (!delivery) return <EmptyState title="Seguimiento pendiente" text="La distribuidora todavia no asigno una entrega a este pedido." />
  return (
    <section className="grid gap-5">
      <div>
        <h1 className="text-2xl font-800 text-slate-950">Seguimiento del pedido #{orderId}</h1>
        <p className="mt-2 text-sm text-slate-600">Aca podes ver por donde va la entrega.</p>
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
        <iframe className="h-80 w-full border-0" title="Mapa de seguimiento" src={mapUrl} />
      ) : (
        <div className="grid h-80 place-items-center bg-slate-100 p-6 text-center text-sm font-700 text-slate-600">
          Sin ubicacion reciente. El chofer tiene que compartir su ubicacion.
        </div>
      )}
      <div className="grid gap-2 p-4 text-sm text-slate-700">
        <p><strong>Chofer:</strong> {delivery.driver_name}</p>
        <p><strong>Vehiculo:</strong> {delivery.vehicle_plate}</p>
        <p><strong>Ultima ubicacion:</strong> {lat && lng ? `${lat}, ${lng}` : 'pendiente'}</p>
        <p><strong>ETA planificada:</strong> {delivery.planned_eta ? new Date(delivery.planned_eta).toLocaleString('es-AR') : 'sin datos'}</p>
        <p><strong>Hora:</strong> {delivery.last_location_at ? new Date(delivery.last_location_at).toLocaleString('es-AR') : 'sin datos'}</p>
      </div>
    </div>
  )
}

function timeOnly(value: string) {
  return new Date(value).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })
}
