import { useEffect, useMemo, useRef, useState } from 'react'
import type { LayerGroup, Map as LeafletMap } from 'leaflet'

import { EmptyState } from '../components/EmptyState'
import { StatusBadge } from '../components/StatusBadge'
import { api } from '../services/api'
import { useAuthStore } from '../stores/authStore'
import { useFeedbackStore } from '../stores/feedbackStore'
import type { DriverProfile, GeoJsonLine, GeoJsonMultiLine, Order, PendingRouteOrder, RoutePlan, RouteRun, RouteStop, Vehicle } from '../types/domain'

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
                {order.commerce_name} - ${Number(order.total).toLocaleString('es-AR')}
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
  const [pendingOrders, setPendingOrders] = useState<PendingRouteOrder[]>([])
  const [selectedOrderIds, setSelectedOrderIds] = useState<number[]>([])
  const [vehicles, setVehicles] = useState<Vehicle[]>([])
  const [drivers, setDrivers] = useState<DriverProfile[]>([])
  const [selectedVehicleIds, setSelectedVehicleIds] = useState<number[]>([])
  const [selectedDriverByVehicleId, setSelectedDriverByVehicleId] = useState<Record<string, number>>({})
  const [loading, setLoading] = useState(true)
  const [fleetLoading, setFleetLoading] = useState(true)
  const [generating, setGenerating] = useState(false)
  const [editingPlanId, setEditingPlanId] = useState<number | null>(null)
  const [draftRuns, setDraftRuns] = useState<RouteRun[]>([])
  const [removedStopIds, setRemovedStopIds] = useState<number[]>([])
  const user = useAuthStore((state) => state.user)
  const showSuccess = useFeedbackStore((state) => state.success)
  const showError = useFeedbackStore((state) => state.error)
  const confirm = useFeedbackStore((state) => state.confirm)
  const routingEnabled = user?.role === 'DISTRIBUTOR' ? user.distributor_access.routing_enabled !== false : true
  const activePlan = useMemo(() => routePlans.find((plan) => plan.status === 'DRAFT') ?? routePlans[0], [routePlans])
  const mapPlan = activePlan && editingPlanId === activePlan.id ? { ...activePlan, runs: draftRuns } : activePlan
  const availableDrivers = useMemo(() => drivers.filter((driver) => driver.active && driver.available), [drivers])
  const selectableVehicles = useMemo(() => vehicles.filter(isVehicleSelectable), [vehicles])
  const selectableVehicleIdSet = useMemo(() => new Set(selectableVehicles.map((vehicle) => vehicle.id)), [selectableVehicles])
  const selectedVehicles = useMemo(() => vehicles.filter((vehicle) => selectedVehicleIds.includes(vehicle.id)), [vehicles, selectedVehicleIds])
  const selectedCapacity = useMemo(() => selectedVehicles.reduce(sumVehicleCapacity, { kg: 0, m3: 0 }), [selectedVehicles])
  const canGenerate = !loading && !fleetLoading && !generating && selectedVehicleIds.some((id) => selectableVehicleIdSet.has(id))

  async function load(date = dispatchDate) {
    setLoading(true)
    try {
      const [plans, pending] = await Promise.all([api.routePlans(date), api.pendingRouteOrders(date)])
      setRoutePlans(plans)
      setPendingOrders(pending)
      setSelectedOrderIds(pending.filter((order) => order.routable).map((order) => order.id))
    } catch (caught) {
      showError(caught instanceof Error ? caught.message : 'No se pudieron cargar las rutas.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (routingEnabled) void load(dispatchDate)
  }, [dispatchDate, routingEnabled])

  useEffect(() => {
    if (!routingEnabled) return
    let disposed = false
    async function loadFleet() {
      setFleetLoading(true)
      try {
        const [loadedVehicles, loadedDrivers] = await Promise.all([api.vehicles(), api.drivers()])
        if (disposed) return
        setVehicles(loadedVehicles)
        setDrivers(loadedDrivers)
        const nextSelectableIds = loadedVehicles.filter(isVehicleSelectable).map((vehicle) => vehicle.id)
        const availableDriverIds = loadedDrivers.filter((driver) => driver.active && driver.available).map((driver) => driver.id)
        setSelectedVehicleIds((current) => current.filter((id) => nextSelectableIds.includes(id)))
        setSelectedDriverByVehicleId((current) =>
          Object.fromEntries(
            Object.entries(current).filter(([vehicleId, driverId]) => nextSelectableIds.includes(Number(vehicleId)) && availableDriverIds.includes(driverId)),
          ),
        )
      } catch (caught) {
        if (!disposed) showError(caught instanceof Error ? caught.message : 'No se pudo cargar la flota.')
      } finally {
        if (!disposed) setFleetLoading(false)
      }
    }
    void loadFleet()
    return () => {
      disposed = true
    }
  }, [routingEnabled, showError])

  function startEditing(plan: RoutePlan) {
    setEditingPlanId(plan.id)
    setDraftRuns(cloneRuns(plan.runs))
    setRemovedStopIds([])
  }

  function cancelEditing() {
    setEditingPlanId(null)
    setDraftRuns([])
    setRemovedStopIds([])
  }

  function toggleOrder(order: PendingRouteOrder, checked: boolean) {
    if (!order.routable) return
    setSelectedOrderIds((current) => (checked ? Array.from(new Set([...current, order.id])) : current.filter((id) => id !== order.id)))
  }

  function toggleVehicle(vehicle: Vehicle, checked: boolean) {
    if (!isVehicleSelectable(vehicle)) return
    setSelectedVehicleIds((current) => (checked ? Array.from(new Set([...current, vehicle.id])) : current.filter((id) => id !== vehicle.id)))
    if (!checked) {
      setSelectedDriverByVehicleId((current) => {
        const next = { ...current }
        delete next[String(vehicle.id)]
        return next
      })
    }
  }

  function selectVehicleDriver(vehicleId: number, driverId: number | null) {
    setSelectedDriverByVehicleId((current) => {
      const next = { ...current }
      if (!driverId) {
        delete next[String(vehicleId)]
        return next
      }
      const duplicateVehicleId = Object.entries(next).find(([currentVehicleId, currentDriverId]) => Number(currentVehicleId) !== vehicleId && currentDriverId === driverId)?.[0]
      if (duplicateVehicleId) {
        showError('Ese chofer ya esta seleccionado en otro vehiculo.')
        return current
      }
      next[String(vehicleId)] = driverId
      return next
    })
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
      const stop = source?.stops.find((item) => item.id === stopId)
      if (!source || !destination || !stop) return current
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

  function removeStop(stopId: number, runId: number) {
    setRemovedStopIds((current) => (current.includes(stopId) ? current : [...current, stopId]))
    setDraftRuns((current) =>
      current.map((run) => {
        if (run.id !== runId) return run
        const stops = resequenceStops(run.stops.filter((stop) => stop.id !== stopId))
        return { ...run, stops, total_stops: stops.length }
      }),
    )
  }

  function moveDraftStopCoordinate(stopId: number, point: { latitude: number; longitude: number }) {
    const lat = point.latitude.toFixed(7)
    const lng = point.longitude.toFixed(7)
    setDraftRuns((current) =>
      current.map((run) => ({
        ...run,
        stops: run.stops.map((stop) => (stop.id === stopId ? { ...stop, lat, lng, delivery_latitude: lat, delivery_longitude: lng } : stop)),
      })),
    )
  }

  async function generate() {
    const vehicleIds = selectedVehicleIds.filter((id) => selectableVehicleIdSet.has(id))
    if (vehicleIds.length === 0) {
      showError('Selecciona al menos un vehiculo activo con capacidad cargada.')
      return
    }
    setGenerating(true)
    try {
      const payload: Record<string, unknown> = { dispatch_date: dispatchDate }
      if (selectedOrderIds.length > 0) payload.order_ids = selectedOrderIds
      payload.vehicle_ids = vehicleIds
      const vehicleDriverIds = Object.fromEntries(Object.entries(selectedDriverByVehicleId).filter(([vehicleId]) => vehicleIds.includes(Number(vehicleId))))
      if (Object.keys(vehicleDriverIds).length > 0) payload.vehicle_driver_ids = vehicleDriverIds
      const draft = await api.generateRoutePlan(payload, `route-preview-${dispatchDate}-${Date.now()}`)
      setRoutePlans((current) => [draft, ...current.filter((item) => item.id !== draft.id)])
      setPendingOrders([])
      setSelectedOrderIds([])
      setSelectedVehicleIds([])
      setSelectedDriverByVehicleId({})
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
          ? await api.confirmRoutePlan(planId, { reviewed: true })
          : action === 'dispatch'
            ? await api.dispatchRoutePlan(planId)
            : await api.replanRoutePlan(planId)
      setRoutePlans((current) => [updated, ...current.filter((item) => item.id !== planId && item.id !== updated.id)])
      showSuccess(action === 'confirm' ? 'Borrador confirmado.' : action === 'dispatch' ? 'Ruta despachada.' : 'Se genero una nueva propuesta.')
      if (editingPlanId === planId) cancelEditing()
    } catch (caught) {
      showError(caught instanceof Error ? caught.message : 'No se pudo completar la accion.')
    }
  }

  async function saveEdit(planId: number) {
    try {
      const updated = await api.patchRouteStops(planId, {
        stops: draftRuns.flatMap((run) =>
          run.stops.map((stop) => ({
            id: stop.id,
            route_run_id: run.id,
            sequence: stop.sequence,
            lat: stop.lat ?? stop.delivery_latitude ?? undefined,
            lng: stop.lng ?? stop.delivery_longitude ?? undefined,
          })),
        ),
        remove_stop_ids: removedStopIds,
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

  if (!routingEnabled) {
    return (
      <section className="grid gap-4">
        <div>
          <h1 className="text-2xl font-800 text-slate-950">Ruteo automatico</h1>
          <p className="mt-2 text-sm leading-6 text-slate-600">Disponible para distribuidoras con plan PRO o IA activo.</p>
        </div>
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-5 text-sm font-700 text-amber-900">
          Tu plan actual no incluye ruteo automatico. Actualiza a PRO o IA para generar hojas de ruta.
        </div>
      </section>
    )
  }

  return (
    <section className="grid gap-5">
      <div className="grid gap-4 border-b border-slate-200 pb-5 lg:grid-cols-[1fr_auto] lg:items-end">
        <div className="max-w-3xl">
          <h1 className="text-2xl font-800 text-slate-950">Ruteo automatico</h1>
          <p className="mt-1 text-sm leading-6 text-slate-600">Selecciona pedidos, genera un borrador multi-chofer, revisa el mapa y confirma la asignacion.</p>
        </div>
        <div className="flex flex-wrap items-end gap-3">
          <label className="grid gap-1 text-sm font-700 text-slate-700">
            Fecha
            <input className="min-h-11 rounded-md border border-slate-300 px-3" type="date" value={dispatchDate} onChange={(event) => setDispatchDate(event.target.value)} />
          </label>
          <div className="rounded-md border border-slate-200 bg-white px-3 py-2 text-xs font-800 text-slate-600">
            Capacidad seleccionada: {formatCapacityAmount(selectedCapacity.kg, 'kg')} - {formatCapacityAmount(selectedCapacity.m3, 'm3')}
          </div>
          <button className="min-h-11 rounded-md bg-brand-600 px-4 font-800 text-white disabled:opacity-60" type="button" disabled={!canGenerate} onClick={() => void generate()}>
            {fleetLoading ? 'Cargando flota...' : generating ? 'Generando...' : 'Generar rutas'}
          </button>
        </div>
      </div>

      {loading ? (
        <div className="rounded-lg border border-slate-200 bg-white p-6 text-sm font-700 text-slate-600">Cargando rutas...</div>
      ) : (
        <>
          <section className="grid gap-4 xl:grid-cols-[minmax(0,1.2fr)_minmax(24rem,0.8fr)]">
            <RoutingMap editable={Boolean(editingPlanId)} plan={mapPlan} onStopMove={moveDraftStopCoordinate} />
            <div className="grid content-start gap-4">
              <VehicleSelectionPanel
                drivers={drivers}
                availableDrivers={availableDrivers}
                fleetLoading={fleetLoading}
                selectedDriverByVehicleId={selectedDriverByVehicleId}
                selectedVehicleIds={selectedVehicleIds}
                vehicles={vehicles}
                onClear={() => {
                  setSelectedVehicleIds([])
                  setSelectedDriverByVehicleId({})
                }}
                onSelectAll={() => setSelectedVehicleIds(selectableVehicles.map((vehicle) => vehicle.id))}
                onSelectDriver={selectVehicleDriver}
                onToggle={toggleVehicle}
              />
              <PendingOrdersPanel orders={pendingOrders} selectedOrderIds={selectedOrderIds} onToggle={toggleOrder} onSelectAll={() => setSelectedOrderIds(pendingOrders.filter((order) => order.routable).map((order) => order.id))} />
              {activePlan ? <RouteSummary plan={activePlan} /> : null}
            </div>
          </section>

          {routePlans.length === 0 ? <EmptyState title="Sin borradores para esta fecha" text="Selecciona pedidos y optimiza para crear una hoja editable." /> : null}

          {routePlans.map((plan) => {
            const editable = editingPlanId === plan.id
            const runs = editable ? draftRuns : plan.runs
            return (
              <article key={plan.id} className="grid gap-5 rounded-lg border border-slate-200 bg-white p-5 shadow-soft">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <h2 className="text-lg font-800 text-slate-950">{plan.route_number ?? `Plan #${plan.id}`}</h2>
                    <p className="mt-1 text-sm text-slate-600">
                      {plan.total_runs} recorridos - {plan.total_orders} pedidos - {Number(plan.total_distance_km).toLocaleString('es-AR')} km - version {plan.planning_version ?? 1}
                    </p>
                  </div>
                  <StatusBadge status={plan.status} />
                </div>

                {editable && (
                  <p className="rounded-md border border-brand-200 bg-brand-50 px-3 py-2 text-sm font-700 text-brand-700">
                    Modo edicion activo. Reordena paradas, ajusta marcadores en el mapa o quita paradas antes de guardar.
                  </p>
                )}

                <div className="grid gap-4 lg:grid-cols-2">
                  {runs.map((run) => (
                    <section key={run.id} className="rounded-lg border border-slate-200 bg-slate-50 p-4">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                          <h3 className="font-800 text-slate-950">{run.driver_name}</h3>
                          <p className="text-sm text-slate-600">
                            {run.vehicle_plate} - {Number(run.load_kg).toLocaleString('es-AR')} kg - {Number(run.load_m3).toLocaleString('es-AR')} m3
                          </p>
                        </div>
                        <span className="rounded-md bg-white px-3 py-1 text-xs font-800 text-slate-600">{run.total_stops} paradas</span>
                      </div>
                      <div className="mt-4 grid gap-3">
                        {run.stops.map((stop, stopIndex) => (
                          <div key={stop.id} className="rounded-md border border-slate-200 bg-white p-3 text-sm">
                            <div className="flex items-center justify-between gap-3">
                              <strong className="text-slate-950">
                                #{stop.sequence} - {stop.commerce_name}
                              </strong>
                              <StatusBadge status={stop.status} />
                            </div>
                            <p className="mt-1 text-slate-600">{stop.delivery_address}</p>
                            <p className="mt-1 text-slate-500">
                              ETA {timeOnly(stop.planned_eta)} - ventana {timeOnly(stop.window_start_at)} - {timeOnly(stop.window_end_at)}
                            </p>
                            {editable && (
                              <div className="mt-3 flex flex-wrap gap-2">
                                <button className="min-h-9 rounded-md border border-slate-300 px-3 text-xs font-800 text-slate-700" type="button" onClick={() => moveStop(run.id, stopIndex, -1)}>
                                  Subir
                                </button>
                                <button className="min-h-9 rounded-md border border-slate-300 px-3 text-xs font-800 text-slate-700" type="button" onClick={() => moveStop(run.id, stopIndex, 1)}>
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
                                <button className="min-h-9 rounded-md border border-red-200 px-3 text-xs font-800 text-red-700" type="button" onClick={() => removeStop(stop.id, run.id)}>
                                  Quitar
                                </button>
                              </div>
                            )}
                          </div>
                        ))}
                        {editable && run.stops.length === 0 ? (
                          <div className="rounded-md border border-dashed border-slate-300 bg-white px-3 py-4 text-sm font-700 text-slate-500">Este recorrido quedara vacio si guardas la edicion.</div>
                        ) : null}
                      </div>
                    </section>
                  ))}
                </div>

                {plan.unassigned_summary.length > 0 ? (
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
                ) : null}

                <div className="flex flex-wrap gap-3">
                  {!editable && plan.status !== 'DISPATCHED' && plan.status !== 'COMPLETED' ? (
                    <button className="min-h-11 rounded-md border border-brand-200 px-4 font-800 text-brand-700" type="button" onClick={() => startEditing(plan)}>
                      Editar ruta
                    </button>
                  ) : null}
                  {!editable && plan.can_delete ? (
                    <button className="min-h-11 rounded-md border border-red-200 px-4 font-800 text-red-700" type="button" onClick={() => void deletePlan(plan.id)}>
                      Eliminar
                    </button>
                  ) : null}
                  {editable ? (
                    <>
                      <button className="min-h-11 rounded-md bg-slate-950 px-4 font-800 text-white" type="button" onClick={() => void saveEdit(plan.id)}>
                        Guardar edicion
                      </button>
                      <button className="min-h-11 rounded-md border border-slate-300 px-4 font-800 text-slate-700" type="button" onClick={cancelEditing}>
                        Cancelar edicion
                      </button>
                    </>
                  ) : null}
                  {!editable && plan.status === 'DRAFT' ? (
                    <button className="min-h-11 rounded-md bg-brand-600 px-4 font-800 text-white" type="button" onClick={() => void runAction('confirm', plan.id)}>
                      Confirmar
                    </button>
                  ) : null}
                  {!editable && plan.status === 'CONFIRMED' ? (
                    <button className="min-h-11 rounded-md bg-brand-600 px-4 font-800 text-white" type="button" onClick={() => void runAction('dispatch', plan.id)}>
                      Despachar
                    </button>
                  ) : null}
                  {!editable && plan.status !== 'DISPATCHED' && plan.status !== 'COMPLETED' ? (
                    <button className="min-h-11 rounded-md border border-slate-300 px-4 font-800 text-slate-700" type="button" onClick={() => void runAction('replan', plan.id)}>
                      Replanificar
                    </button>
                  ) : null}
                </div>
              </article>
            )
          })}
        </>
      )}
    </section>
  )
}

function VehicleSelectionPanel({
  vehicles,
  drivers,
  availableDrivers,
  selectedVehicleIds,
  selectedDriverByVehicleId,
  fleetLoading,
  onToggle,
  onSelectDriver,
  onSelectAll,
  onClear,
}: {
  vehicles: Vehicle[]
  drivers: DriverProfile[]
  availableDrivers: DriverProfile[]
  selectedVehicleIds: number[]
  selectedDriverByVehicleId: Record<string, number>
  fleetLoading: boolean
  onToggle: (vehicle: Vehicle, checked: boolean) => void
  onSelectDriver: (vehicleId: number, driverId: number | null) => void
  onSelectAll: () => void
  onClear: () => void
}) {
  const driverByVehicleId = useMemo(() => buildVehicleDriverMap(drivers), [drivers])
  const selectedDriverIds = useMemo(() => new Set(Object.values(selectedDriverByVehicleId)), [selectedDriverByVehicleId])
  const selectableCount = vehicles.filter(isVehicleSelectable).length

  return (
    <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-soft">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="font-800 text-slate-950">Vehiculos y choferes</h2>
          <p className="mt-1 text-sm text-slate-600">{selectedVehicleIds.length} vehiculos seleccionados - chofer opcional</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button className="min-h-9 rounded-md border border-slate-300 px-3 text-xs font-800 text-slate-700 disabled:opacity-50" type="button" disabled={selectableCount === 0} onClick={onSelectAll}>
            Todos
          </button>
          <button className="min-h-9 rounded-md border border-slate-300 px-3 text-xs font-800 text-slate-700 disabled:opacity-50" type="button" disabled={selectedVehicleIds.length === 0} onClick={onClear}>
            Limpiar
          </button>
        </div>
      </div>

      <div className="mt-4 grid max-h-[18rem] gap-2 overflow-y-auto pr-1">
        {fleetLoading ? (
          <p className="rounded-md border border-dashed border-slate-300 px-3 py-4 text-sm font-700 text-slate-500">Cargando vehiculos y choferes...</p>
        ) : vehicles.length === 0 ? (
          <p className="rounded-md border border-dashed border-slate-300 px-3 py-4 text-sm font-700 text-slate-500">Carga vehiculos antes de generar rutas.</p>
        ) : (
          vehicles.map((vehicle) => {
            const driver = driverByVehicleId.get(vehicle.id)
            const selectable = isVehicleSelectable(vehicle)
            const selected = selectedVehicleIds.includes(vehicle.id)
            const selectedDriverId = selectedDriverByVehicleId[String(vehicle.id)] ?? ''
            return (
              <div
                key={vehicle.id}
                className={`grid gap-3 rounded-md border p-3 text-sm ${
                  selected ? 'border-brand-300 bg-brand-50' : 'border-slate-200 bg-slate-50'
                } ${selectable ? '' : 'opacity-70'}`}
              >
                <label className={`grid grid-cols-[auto_1fr] gap-3 ${selectable ? 'cursor-pointer' : ''}`}>
                  <input className="mt-1 h-4 w-4" type="checkbox" disabled={!selectable} checked={selected} onChange={(event) => onToggle(vehicle, event.target.checked)} />
                  <span>
                    <span className="flex flex-wrap items-center gap-2">
                      <span className="font-800 text-slate-950">{vehicle.plate}</span>
                      <StatusBadge status={vehicle.status} />
                    </span>
                    <span className="mt-1 block text-slate-600">{vehicleDescription(vehicle)}</span>
                    <span className="mt-1 block text-xs font-700 text-slate-500">
                      Capacidad {formatVehicleCapacity(vehicle)} - {driver ? `asignado habitual: ${driver.full_name}` : vehicleBlockReason(vehicle)}
                    </span>
                  </span>
                </label>

                {selected ? (
                  <label className="grid gap-1 border-t border-slate-200 pt-3 text-xs font-800 text-slate-600">
                    Chofer disponible
                    <select
                      className="min-h-10 rounded-md border border-slate-300 bg-white px-3 text-sm font-700 text-slate-800"
                      value={selectedDriverId}
                      onChange={(event) => onSelectDriver(vehicle.id, event.target.value ? Number(event.target.value) : null)}
                    >
                      <option value="">Sin chofer por ahora</option>
                      {availableDrivers.map((candidate) => {
                        const usedElsewhere = selectedDriverIds.has(candidate.id) && selectedDriverId !== candidate.id
                        return (
                          <option key={candidate.id} value={candidate.id} disabled={usedElsewhere}>
                            {candidate.full_name}{candidate.assigned_vehicle_plate ? ` - ${candidate.assigned_vehicle_plate}` : ''}
                          </option>
                        )
                      })}
                    </select>
                  </label>
                ) : null}
              </div>
            )
          })
        )}
      </div>

      {!fleetLoading && selectableCount > 0 && selectedVehicleIds.length === 0 ? (
        <p className="mt-3 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm font-700 text-amber-900">Selecciona al menos un vehiculo para aplicar su capacidad al ruteo.</p>
      ) : null}
      {!fleetLoading && vehicles.length > 0 && selectableCount === 0 ? (
        <p className="mt-3 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm font-700 text-amber-900">No hay vehiculos activos con capacidad cargada.</p>
      ) : null}
    </section>
  )
}

function PendingOrdersPanel({
  orders,
  selectedOrderIds,
  onToggle,
  onSelectAll,
}: {
  orders: PendingRouteOrder[]
  selectedOrderIds: number[]
  onToggle: (order: PendingRouteOrder, checked: boolean) => void
  onSelectAll: () => void
}) {
  return (
    <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-soft">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="font-800 text-slate-950">Pedidos pendientes</h2>
          <p className="mt-1 text-sm text-slate-600">{orders.length} pedidos disponibles</p>
        </div>
        <button className="min-h-9 rounded-md border border-slate-300 px-3 text-xs font-800 text-slate-700" type="button" onClick={onSelectAll}>
          Seleccionar
        </button>
      </div>
      <div className="mt-4 grid max-h-[21rem] gap-2 overflow-y-auto pr-1">
        {orders.length === 0 ? (
          <p className="rounded-md border border-dashed border-slate-300 px-3 py-4 text-sm font-700 text-slate-500">Sin pedidos pendientes fuera de borradores activos.</p>
        ) : (
          orders.map((order) => (
            <label key={order.id} className="grid grid-cols-[auto_1fr] gap-3 rounded-md border border-slate-200 bg-slate-50 p-3 text-sm">
              <input className="mt-1 h-4 w-4" type="checkbox" disabled={!order.routable} checked={selectedOrderIds.includes(order.id)} onChange={(event) => onToggle(order, event.target.checked)} />
              <span>
                <span className="block font-800 text-slate-950">{order.commerce_name}</span>
                <span className="block text-slate-600">{order.delivery_address}</span>
                <span className="mt-1 block text-xs font-700 text-slate-500">
                  {Number(order.planned_weight_kg).toLocaleString('es-AR')} kg - {Number(order.planned_volume_m3).toLocaleString('es-AR')} m3
                  {order.exclusion_reason ? ` - ${reasonLabel(order.exclusion_reason)}` : ''}
                </span>
              </span>
            </label>
          ))
        )}
      </div>
    </section>
  )
}

function RouteSummary({ plan }: { plan: RoutePlan }) {
  return (
    <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-soft">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="font-800 text-slate-950">{plan.route_number ?? `Plan #${plan.id}`}</h2>
          <p className="mt-1 text-sm text-slate-600">
            {plan.total_runs} recorridos - {plan.total_orders} paradas - {Number(plan.total_distance_km).toLocaleString('es-AR')} km
          </p>
        </div>
        <StatusBadge status={plan.status} />
      </div>
      {String(plan.routing_status ?? '').startsWith('fallback') ? (
        <p className="mt-3 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm font-700 text-amber-900">Distancia estimada con fallback local.</p>
      ) : null}
    </section>
  )
}

function RoutingMap({
  plan,
  editable,
  onStopMove,
}: {
  plan: RoutePlan | undefined
  editable: boolean
  onStopMove: (stopId: number, point: { latitude: number; longitude: number }) => void
}) {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const mapRef = useRef<LeafletMap | null>(null)
  const layerRef = useRef<LayerGroup | null>(null)
  const editableRef = useRef(editable)
  const onStopMoveRef = useRef(onStopMove)
  editableRef.current = editable
  onStopMoveRef.current = onStopMove

  useEffect(() => {
    let disposed = false
    async function mount() {
      if (!containerRef.current || mapRef.current) return
      const L = await import('leaflet')
      if (disposed || !containerRef.current) return
      const map = L.map(containerRef.current, { zoomControl: false, attributionControl: true }).setView([-34.6037, -58.3816], 11)
      L.control.zoom({ position: 'bottomright' }).addTo(map)
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
        attribution: '&copy; OpenStreetMap contributors',
      }).addTo(map)
      mapRef.current = map
      layerRef.current = L.layerGroup().addTo(map)
      requestAnimationFrame(() => map.invalidateSize())
    }
    void mount()
    return () => {
      disposed = true
      layerRef.current?.remove()
      mapRef.current?.remove()
      layerRef.current = null
      mapRef.current = null
    }
  }, [])

  useEffect(() => {
    async function renderPlan() {
      const map = mapRef.current
      const layer = layerRef.current
      if (!map || !layer) return
      const L = await import('leaflet')
      layer.clearLayers()
      if (!plan) return
      const bounds: Array<[number, number]> = []

      plan.runs.forEach((run, runIndex) => {
        const origin = originPoint(run)
        if (origin) {
          bounds.push(origin)
          L.circleMarker(origin, { radius: 7, color: '#0f172a', fillColor: '#0f172a', fillOpacity: 0.95, weight: 2 }).bindTooltip('Origen', { permanent: false }).addTo(layer)
        }
        addGeometry(L, layer, run.route_geometry ?? plan.route_geometry, runIndex)
        run.stops.forEach((stop) => {
          const point = stopPoint(stop)
          if (!point) return
          bounds.push(point)
          const marker = L.marker(point, {
            draggable: editableRef.current,
            icon: L.divIcon({
              className: 'routing-map-stop-marker',
              iconSize: [32, 32],
              iconAnchor: [16, 16],
              html: `<span>${stop.sequence}</span>`,
            }),
          }).addTo(layer)
          marker.bindTooltip(stop.commerce_name, { direction: 'top', offset: [0, -14] })
          marker.on('dragend', () => {
            if (!editableRef.current) return
            const next = marker.getLatLng()
            onStopMoveRef.current(stop.id, { latitude: next.lat, longitude: next.lng })
          })
        })
      })
      if (bounds.length > 0) map.fitBounds(bounds, { padding: [26, 26], maxZoom: 14 })
    }
    void renderPlan()
  }, [plan, editable])

  return (
    <section className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-soft">
      <div ref={containerRef} className="routing-map-canvas h-[28rem] min-h-[24rem] w-full" aria-label="Mapa de ruteo" />
    </section>
  )
}

function addGeometry(L: typeof import('leaflet'), layer: LayerGroup, geometry: GeoJsonLine | GeoJsonMultiLine | null | undefined, index: number) {
  if (!geometry) return
  const color = ['#0369a1', '#059669', '#7c3aed', '#d97706'][index % 4]
  if (geometry.type === 'LineString') {
    const points = geometry.coordinates.map(([lng, lat]) => [lat, lng] as [number, number])
    L.polyline(points, { color, weight: 4, opacity: 0.78 }).addTo(layer)
  }
  if (geometry.type === 'MultiLineString') {
    geometry.coordinates.forEach((line) => {
      const points = line.map(([lng, lat]) => [lat, lng] as [number, number])
      L.polyline(points, { color, weight: 4, opacity: 0.78 }).addTo(layer)
    })
  }
}

function originPoint(run: RouteRun): [number, number] | null {
  const lat = Number(run.origin_snapshot?.latitude ?? run.origin_snapshot?.lat)
  const lng = Number(run.origin_snapshot?.longitude ?? run.origin_snapshot?.lng)
  return Number.isFinite(lat) && Number.isFinite(lng) ? [lat, lng] : null
}

function stopPoint(stop: RouteStop): [number, number] | null {
  const lat = Number(stop.lat ?? stop.delivery_latitude)
  const lng = Number(stop.lng ?? stop.delivery_longitude)
  return Number.isFinite(lat) && Number.isFinite(lng) ? [lat, lng] : null
}

function buildVehicleDriverMap(drivers: DriverProfile[]) {
  const driverByVehicleId = new Map<number, DriverProfile>()
  drivers.forEach((driver) => {
    if (driver.assigned_vehicle && driver.active && driver.available) {
      driverByVehicleId.set(driver.assigned_vehicle, driver)
    }
  })
  return driverByVehicleId
}

function isVehicleSelectable(vehicle: Vehicle) {
  return vehicle.active && !['MAINTENANCE', 'INACTIVE'].includes(vehicle.status) && hasVehicleCapacity(vehicle)
}

function hasVehicleCapacity(vehicle: Vehicle) {
  return Number(vehicle.capacity_kg ?? 0) > 0 || Number(vehicle.capacity_m3 ?? 0) > 0
}

function sumVehicleCapacity(total: { kg: number; m3: number }, vehicle: Vehicle) {
  return {
    kg: total.kg + Math.max(0, Number(vehicle.capacity_kg ?? 0)),
    m3: total.m3 + Math.max(0, Number(vehicle.capacity_m3 ?? 0)),
  }
}

function vehicleDescription(vehicle: Vehicle) {
  return [vehicle.vehicle_type, vehicle.brand, vehicle.model].filter(Boolean).join(' - ') || 'Vehiculo de reparto'
}

function formatVehicleCapacity(vehicle: Vehicle) {
  return `${formatCapacityAmount(Number(vehicle.capacity_kg ?? 0), 'kg')} - ${formatCapacityAmount(Number(vehicle.capacity_m3 ?? 0), 'm3')}`
}

function formatCapacityAmount(value: number, unit: 'kg' | 'm3') {
  if (!Number.isFinite(value) || value <= 0) return `sin ${unit}`
  return `${value.toLocaleString('es-AR', { maximumFractionDigits: unit === 'kg' ? 0 : 2 })} ${unit}`
}

function vehicleBlockReason(vehicle: Vehicle) {
  if (!vehicle.active || ['MAINTENANCE', 'INACTIVE'].includes(vehicle.status)) return 'no disponible'
  if (!hasVehicleCapacity(vehicle)) return 'sin capacidad cargada'
  return 'sin chofer habitual'
}

function cloneRuns(runs: RouteRun[]) {
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
  if (reason === 'missing_coords' || reason === 'missing_coordinates') return 'faltan coordenadas'
  if (reason === 'capacity_exceeded') return 'supera la capacidad disponible'
  if (reason === 'window_infeasible') return 'la franja no cierra con ninguna ruta'
  if (reason === 'missing_physical_lines') return 'sin lineas fisicas'
  return reason
}
