import { useEffect, useState } from 'react'

import { EmptyState } from '../components/EmptyState'
import { StatusBadge } from '../components/StatusBadge'
import { api } from '../services/api'
import { useFeedbackStore } from '../stores/feedbackStore'
import type { Order, RoutePlan } from '../types/domain'

export function DashboardOrdersRoutingPage() {
  const [orders, setOrders] = useState<Order[]>([])
  const showError = useFeedbackStore((state) => state.error)

  useEffect(() => {
    void api
      .orders()
      .then(setOrders)
      .catch((caught) => showError(caught instanceof Error ? caught.message : 'No se pudieron cargar los pedidos.'))
  }, [showError])

  async function saveSchedule(order: Order, payload: Partial<Order>) {
    try {
      const updated = await api.updateOrder(order.id, payload as Record<string, unknown>)
      setOrders((current) => current.map((item) => (item.id === updated.id ? updated : item)))
    } catch (caught) {
      showError(caught instanceof Error ? caught.message : 'No se pudo guardar la programacion.')
    }
  }

  async function updateStatus(order: Order, status: string) {
    try {
      const updated = await api.updateOrderStatus(order.id, status)
      setOrders((current) => current.map((item) => (item.id === updated.id ? updated : item)))
    } catch (caught) {
      showError(caught instanceof Error ? caught.message : 'No se pudo actualizar el estado.')
    }
  }

  return (
    <section className="grid gap-4">
      <div>
        <h1 className="text-2xl font-800 text-slate-950">Gestion de pedidos</h1>
        <p className="mt-2 text-sm leading-6 text-slate-600">Ajusta fecha y franja antes de generar rutas. El ruteo toma estos datos como restriccion operativa.</p>
      </div>
      {orders.map((order) => (
        <article key={order.id} className="rounded-lg border border-slate-200 bg-white p-4 shadow-soft">
          <div className="flex flex-wrap justify-between gap-3">
            <div>
              <h2 className="text-lg font-800 text-slate-950">Pedido #{order.id}</h2>
              <p className="text-sm text-slate-600">
                {order.commerce_name} · ${Number(order.total).toLocaleString('es-AR')}
              </p>
            </div>
            <StatusBadge status={order.status} />
          </div>

          <div className="mt-4 grid gap-3 md:grid-cols-3">
            <label className="grid gap-1 text-sm font-700 text-slate-700">
              Fecha de reparto
              <input
                className="min-h-10 rounded-md border border-slate-300 px-3"
                type="date"
                defaultValue={order.dispatch_date}
                onBlur={(event) => void saveSchedule(order, { dispatch_date: event.target.value })}
              />
            </label>
            <label className="grid gap-1 text-sm font-700 text-slate-700">
              Franja desde
              <input
                className="min-h-10 rounded-md border border-slate-300 px-3"
                type="time"
                defaultValue={order.delivery_window_start ?? ''}
                onBlur={(event) => void saveSchedule(order, { delivery_window_start: event.target.value || null })}
              />
            </label>
            <label className="grid gap-1 text-sm font-700 text-slate-700">
              Franja hasta
              <input
                className="min-h-10 rounded-md border border-slate-300 px-3"
                type="time"
                defaultValue={order.delivery_window_end ?? ''}
                onBlur={(event) => void saveSchedule(order, { delivery_window_end: event.target.value || null })}
              />
            </label>
          </div>

          <div className="mt-4 flex flex-wrap gap-2">
            {['ACCEPTED', 'PREPARING', 'SCHEDULED', 'ON_THE_WAY', 'DELIVERED', 'CANCELLED'].map((status) => (
              <button
                key={status}
                className="min-h-10 rounded-md border border-slate-300 px-3 text-xs font-800 text-slate-700"
                type="button"
                onClick={() => void updateStatus(order, status)}
              >
                {status}
              </button>
            ))}
          </div>
        </article>
      ))}
    </section>
  )
}

export function DashboardRoutingPage() {
  const [dispatchDate, setDispatchDate] = useState(defaultRouteDate())
  const [routePlans, setRoutePlans] = useState<RoutePlan[]>([])
  const [loading, setLoading] = useState(true)
  const [generating, setGenerating] = useState(false)
  const [editingPlanId, setEditingPlanId] = useState<number | null>(null)
  const [draftRuns, setDraftRuns] = useState<RoutePlan['runs']>([])
  const showSuccess = useFeedbackStore((state) => state.success)
  const showError = useFeedbackStore((state) => state.error)
  const confirm = useFeedbackStore((state) => state.confirm)

  async function load(date = dispatchDate) {
    setLoading(true)
    try {
      const plans = await api.routePlans(date)
      setRoutePlans(plans)
    } catch (caught) {
      showError(caught instanceof Error ? caught.message : 'No se pudieron cargar las rutas.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void load(dispatchDate)
  }, [dispatchDate])

  function startEditing(plan: RoutePlan) {
    setEditingPlanId(plan.id)
    setDraftRuns(cloneRuns(plan.runs))
  }

  function cancelEditing() {
    setEditingPlanId(null)
    setDraftRuns([])
  }

  function moveStop(runId: number, stopIndex: number, direction: -1 | 1) {
    setDraftRuns((current) =>
      current.map((run) => {
        if (run.id !== runId) return run
        const nextIndex = stopIndex + direction
        if (nextIndex < 0 || nextIndex >= run.stops.length) return run
        const stops = [...run.stops]
        ;[stops[stopIndex], stops[nextIndex]] = [stops[nextIndex], stops[stopIndex]]
        return { ...run, stops: resequenceStops(stops), total_stops: stops.length }
      }),
    )
  }

  function moveStopToRun(stopId: number, fromRunId: number, toRunId: number) {
    if (fromRunId === toRunId) return
    setDraftRuns((current) => {
      const source = current.find((run) => run.id === fromRunId)
      const destination = current.find((run) => run.id === toRunId)
      if (!source || !destination) return current
      const stop = source.stops.find((item) => item.id === stopId)
      if (!stop) return current
      return current.map((run) => {
        if (run.id === fromRunId) {
          const stops = resequenceStops(source.stops.filter((item) => item.id !== stopId))
          return { ...run, stops, total_stops: stops.length }
        }
        if (run.id === toRunId) {
          const stops = resequenceStops([...destination.stops, stop])
          return { ...run, stops, total_stops: stops.length }
        }
        return run
      })
    })
  }

  async function generate() {
    setGenerating(true)
    try {
      const draft = await api.generateRoutePlan({ dispatch_date: dispatchDate })
      setRoutePlans((current) => [draft, ...current.filter((item) => item.id !== draft.id)])
      showSuccess('Rutas generadas.')
    } catch (caught) {
      showError(caught instanceof Error ? caught.message : 'No se pudo generar el borrador.')
    } finally {
      setGenerating(false)
    }
  }

  async function runAction(action: 'confirm' | 'dispatch' | 'replan', planId: number) {
    const confirmed = await confirm({
      title: action === 'confirm' ? 'Confirmar borrador' : action === 'dispatch' ? 'Despachar ruta' : 'Replanificar ruta',
      message:
        action === 'confirm'
          ? 'La ruta quedara asignada y lista para despacho.'
          : action === 'dispatch'
            ? 'El chofer vera esta secuencia como ruta activa.'
            : 'Se generara una nueva propuesta para esta fecha.',
      confirmLabel: action === 'confirm' ? 'Confirmar' : action === 'dispatch' ? 'Despachar' : 'Replanificar',
      cancelLabel: 'Cancelar',
    })
    if (!confirmed) return
    try {
      const updated =
        action === 'confirm'
          ? await api.confirmRoutePlan(planId)
          : action === 'dispatch'
            ? await api.dispatchRoutePlan(planId)
            : await api.replanRoutePlan(planId)
      setRoutePlans((current) => [updated, ...current.filter((item) => item.id !== planId && item.id !== updated.id)])
      showSuccess(
        action === 'confirm'
          ? 'Borrador confirmado.'
          : action === 'dispatch'
            ? 'Ruta despachada.'
            : 'Se genero una nueva propuesta.',
      )
      if (editingPlanId === planId) cancelEditing()
    } catch (caught) {
      showError(caught instanceof Error ? caught.message : 'No se pudo completar la accion.')
    }
  }

  async function saveEdit(planId: number) {
    try {
      const updated = await api.editRoutePlan(planId, {
        runs: draftRuns.map((run) => ({
          id: run.id,
          stop_ids: run.stops.map((stop) => stop.id),
        })),
      })
      setRoutePlans((current) => current.map((item) => (item.id === updated.id ? updated : item)))
      showSuccess('Ruta editada y recalculada.')
      cancelEditing()
    } catch (caught) {
      showError(caught instanceof Error ? caught.message : 'No se pudo guardar la edicion.')
    }
  }

  async function deletePlan(planId: number) {
    const confirmed = await confirm({
      title: 'Eliminar ruta',
      message: 'Solo se puede borrar si no esta asignada a un chofer ni iniciada.',
      confirmLabel: 'Eliminar',
      cancelLabel: 'Cancelar',
      tone: 'danger',
    })
    if (!confirmed) return
    try {
      await api.deleteRoutePlan(planId)
      setRoutePlans((current) => current.filter((item) => item.id !== planId))
      if (editingPlanId === planId) cancelEditing()
      showSuccess('Ruta eliminada.')
    } catch (caught) {
      showError(caught instanceof Error ? caught.message : 'No se pudo eliminar la ruta.')
    }
  }

  return (
    <section className="grid gap-5">
      <div className="flex flex-col gap-3 rounded-lg border border-slate-200 bg-white p-4 shadow-soft md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="text-2xl font-800 text-slate-950">Ruteo automatico</h1>
          <p className="mt-1 text-sm leading-6 text-slate-600">Genera recorridos por fecha, revisa pedidos no asignados y edita la propuesta antes de despachar.</p>
        </div>
        <div className="flex flex-wrap items-end gap-3">
          <label className="grid gap-1 text-sm font-700 text-slate-700">
            Fecha
            <input className="min-h-11 rounded-md border border-slate-300 px-3" type="date" value={dispatchDate} onChange={(event) => setDispatchDate(event.target.value)} />
          </label>
          <button className="min-h-11 rounded-md bg-brand-600 px-4 font-800 text-white" type="button" disabled={generating} onClick={() => void generate()}>
            {generating ? 'Generando...' : 'Generar rutas'}
          </button>
        </div>
      </div>

      {loading ? (
        <div className="rounded-lg border border-slate-200 bg-white p-6 text-sm font-700 text-slate-600">Cargando rutas...</div>
      ) : routePlans.length === 0 ? (
        <EmptyState title="Sin borradores para esta fecha" text="Genera una propuesta para ver recorridos y pedidos no asignados." />
      ) : (
        routePlans.map((plan) => {
          const editable = editingPlanId === plan.id
          const runs = editable ? draftRuns : plan.runs

          return (
            <article key={plan.id} className="grid gap-5 rounded-lg border border-slate-200 bg-white p-5 shadow-soft">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h2 className="text-lg font-800 text-slate-950">Plan #{plan.id}</h2>
                  <p className="mt-1 text-sm text-slate-600">
                    {plan.total_runs} recorridos · {plan.total_orders} pedidos · {Number(plan.total_distance_km).toLocaleString('es-AR')} km
                  </p>
                </div>
                <StatusBadge status={plan.status} />
              </div>

              {editable && (
                <p className="rounded-md border border-brand-200 bg-brand-50 px-3 py-2 text-sm font-700 text-brand-700">
                  Modo edicion activo. Reordena paradas o muevelas entre recorridos y despues guarda para recalcular la ruta.
                </p>
              )}

              <div className="grid gap-4 lg:grid-cols-2">
                {runs.map((run) => (
                  <section key={run.id} className="rounded-lg border border-slate-200 bg-slate-50 p-4">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <h3 className="font-800 text-slate-950">{run.driver_name}</h3>
                        <p className="text-sm text-slate-600">
                          {run.vehicle_plate} · {Number(run.load_kg).toLocaleString('es-AR')} kg · {Number(run.load_m3).toLocaleString('es-AR')} m3
                        </p>
                      </div>
                      <span className="rounded-md bg-white px-3 py-1 text-xs font-800 text-slate-600">{run.total_stops} paradas</span>
                    </div>
                    <div className="mt-4 grid gap-3">
                      {run.stops.map((stop, stopIndex) => (
                        <div key={stop.id} className="rounded-md border border-slate-200 bg-white p-3 text-sm">
                          <div className="flex items-center justify-between gap-3">
                            <strong className="text-slate-950">
                              #{stop.sequence} · {stop.commerce_name}
                            </strong>
                            <StatusBadge status={stop.status} />
                          </div>
                          <p className="mt-1 text-slate-600">{stop.delivery_address}</p>
                          <p className="mt-1 text-slate-500">
                            ETA {timeOnly(stop.planned_eta)} · ventana {timeOnly(stop.window_start_at)} - {timeOnly(stop.window_end_at)}
                          </p>
                          {editable && (
                            <div className="mt-3 flex flex-wrap gap-2">
                              <button
                                className="min-h-9 rounded-md border border-slate-300 px-3 text-xs font-800 text-slate-700"
                                type="button"
                                onClick={() => moveStop(run.id, stopIndex, -1)}
                              >
                                Subir
                              </button>
                              <button
                                className="min-h-9 rounded-md border border-slate-300 px-3 text-xs font-800 text-slate-700"
                                type="button"
                                onClick={() => moveStop(run.id, stopIndex, 1)}
                              >
                                Bajar
                              </button>
                              <select
                                className="min-h-9 rounded-md border border-slate-300 px-3 text-xs font-800 text-slate-700"
                                defaultValue=""
                                onChange={(event) => {
                                  if (!event.target.value) return
                                  moveStopToRun(stop.id, run.id, Number(event.target.value))
                                  event.target.value = ''
                                }}
                              >
                                <option value="">Mover a...</option>
                                {draftRuns
                                  .filter((candidateRun) => candidateRun.id !== run.id)
                                  .map((candidateRun) => (
                                    <option key={candidateRun.id} value={candidateRun.id}>
                                      {candidateRun.driver_name}
                                    </option>
                                  ))}
                              </select>
                            </div>
                          )}
                        </div>
                      ))}
                      {editable && run.stops.length === 0 && (
                        <div className="rounded-md border border-dashed border-slate-300 bg-white px-3 py-4 text-sm font-700 text-slate-500">
                          Este recorrido quedara vacio si guardas la edicion.
                        </div>
                      )}
                    </div>
                  </section>
                ))}
              </div>

              {plan.unassigned_summary.length > 0 && (
                <section className="rounded-lg border border-amber-200 bg-amber-50 p-4">
                  <h3 className="font-800 text-amber-950">Pedidos no asignados</h3>
                  <div className="mt-3 grid gap-2">
                    {plan.unassigned_summary.map((item, index) => (
                      <p key={`${item.order_id}-${index}`} className="text-sm text-amber-900">
                        Pedido #{item.order_id}: {reasonLabel(item.reason)}
                      </p>
                    ))}
                  </div>
                </section>
              )}

              <div className="flex flex-wrap gap-3">
                {!editable && plan.status !== 'DISPATCHED' && plan.status !== 'COMPLETED' && (
                  <button className="min-h-11 rounded-md border border-brand-200 px-4 font-800 text-brand-700" type="button" onClick={() => startEditing(plan)}>
                    Editar ruta
                  </button>
                )}
                {!editable && plan.can_delete && (
                  <button className="min-h-11 rounded-md border border-red-200 px-4 font-800 text-red-700" type="button" onClick={() => void deletePlan(plan.id)}>
                    Eliminar
                  </button>
                )}
                {editable && (
                  <>
                    <button className="min-h-11 rounded-md bg-slate-950 px-4 font-800 text-white" type="button" onClick={() => void saveEdit(plan.id)}>
                      Guardar edicion
                    </button>
                    <button className="min-h-11 rounded-md border border-slate-300 px-4 font-800 text-slate-700" type="button" onClick={cancelEditing}>
                      Cancelar edicion
                    </button>
                  </>
                )}
                {!editable && plan.status === 'DRAFT' && (
                  <button className="min-h-11 rounded-md bg-brand-600 px-4 font-800 text-white" type="button" onClick={() => void runAction('confirm', plan.id)}>
                    Confirmar
                  </button>
                )}
                {!editable && plan.status === 'CONFIRMED' && (
                  <button className="min-h-11 rounded-md bg-brand-600 px-4 font-800 text-white" type="button" onClick={() => void runAction('dispatch', plan.id)}>
                    Despachar
                  </button>
                )}
                {!editable && plan.status !== 'DISPATCHED' && plan.status !== 'COMPLETED' && (
                  <button className="min-h-11 rounded-md border border-slate-300 px-4 font-800 text-slate-700" type="button" onClick={() => void runAction('replan', plan.id)}>
                    Replanificar
                  </button>
                )}
              </div>
            </article>
          )
        })
      )}
    </section>
  )
}

function cloneRuns(runs: RoutePlan['runs']) {
  return runs.map((run) => ({
    ...run,
    stops: run.stops.map((stop) => ({ ...stop })),
  }))
}

function resequenceStops<T extends { sequence: number }>(stops: T[]) {
  return stops.map((stop, index) => ({ ...stop, sequence: index + 1 }))
}

function defaultRouteDate() {
  const base = new Date()
  base.setDate(base.getDate() + 1)
  return base.toISOString().slice(0, 10)
}

function timeOnly(value: string) {
  return new Date(value).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })
}

function reasonLabel(reason: string) {
  if (reason === 'missing_coords') return 'faltan coordenadas'
  if (reason === 'capacity_exceeded') return 'supera la capacidad disponible'
  if (reason === 'window_infeasible') return 'la franja no cierra con ninguna ruta'
  return reason
}
