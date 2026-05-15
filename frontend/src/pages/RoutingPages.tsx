import { useEffect, useMemo, useRef, useState } from 'react'
import type { DragEvent, FormEvent } from 'react'
import type { LayerGroup, Map as LeafletMap } from 'leaflet'

import { EmptyState } from '../components/EmptyState'
import { Icon } from '../components/Icon'
import { StatusBadge } from '../components/StatusBadge'
import { api } from '../services/api'
import { useAuthStore } from '../stores/authStore'
import { useFeedbackStore } from '../stores/feedbackStore'
import type {
  Commerce,
  DistributorDeliverySlot,
  DriverProfile,
  GeoJsonLine,
  GeoJsonMultiLine,
  Order,
  PendingRouteOrder,
  Product,
  RoutePlan,
  RouteRun,
  RouteStop,
  Vehicle,
} from '../types/domain'

type ManualRunsState = Record<string, number[]>

type ManualDragPayload =
  | { source: 'pending-order'; orderId: number }
  | { source: 'manual-order'; orderId: number; fromVehicleId: number }
  | { source: 'draft-stop'; stopId: number; fromRunId: number }

type CapacityMetrics = {
  loadKg: number
  loadM3: number
  capacityKg: number
  capacityM3: number
  kgPercent: number
  m3Percent: number
  overCapacity: boolean
}

type OrderScheduleDraft = {
  dispatch_date: string
  delivery_slot_id: number
}

type ManualOrderLineDraft = {
  productId: number
  quantity: string
}

type ManualOrderPayload = {
  commerce: number
  dispatch_date: string
  delivery_slot: number
  notes: string
  line_items: Array<{ product_id: number; quantity: string }>
}

type RouteFilterSummary = {
  orders: number
  kg: number
  m3: number
}

const orderStatusFilterOptions = [
  { id: 'ALL', label: 'Todos', statuses: [] },
  { id: 'PENDING', label: 'Pendientes', statuses: ['PENDING'] },
  { id: 'IN_PROGRESS', label: 'Aceptados', statuses: ['ACCEPTED', 'PREPARING'] },
  { id: 'ROUTING', label: 'En reparto', statuses: ['SCHEDULED', 'ON_THE_WAY'] },
  { id: 'CLOSED', label: 'Cerrados', statuses: ['DELIVERED', 'REJECTED', 'CANCELLED'] },
]

const orderStatusPriority: Record<string, number> = {
  PENDING: 0,
  ACCEPTED: 1,
  PREPARING: 2,
  SCHEDULED: 3,
  ON_THE_WAY: 4,
  DELIVERED: 5,
  REJECTED: 6,
  CANCELLED: 7,
}

export function DashboardOrdersRoutingPage() {
  const [orders, setOrders] = useState<Order[]>([])
  const [commerces, setCommerces] = useState<Commerce[]>([])
  const [products, setProducts] = useState<Product[]>([])
  const [deliverySlots, setDeliverySlots] = useState<DistributorDeliverySlot[]>([])
  const [statusFilter, setStatusFilter] = useState('ALL')
  const [slotFilter, setSlotFilter] = useState('ALL')
  const [dateFilter, setDateFilter] = useState('')
  const [query, setQuery] = useState('')
  const [loading, setLoading] = useState(true)
  const [activeOrderId, setActiveOrderId] = useState<number | null>(null)
  const [selectedCustomerOrder, setSelectedCustomerOrder] = useState<Order | null>(null)
  const [drafts, setDrafts] = useState<Record<number, OrderScheduleDraft>>({})
  const [savingOrderId, setSavingOrderId] = useState<number | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)
  const [manualOrderOpen, setManualOrderOpen] = useState(false)
  const [manualOrderSaving, setManualOrderSaving] = useState(false)
  const [manualOrderError, setManualOrderError] = useState<string | null>(null)
  const showError = useFeedbackStore((state) => state.error)
  const showSuccess = useFeedbackStore((state) => state.success)
  const confirm = useFeedbackStore((state) => state.confirm)
  const activeSlots = useMemo(
    () => deliverySlots.filter((slot) => slot.active).sort((left, right) => left.sort_order - right.sort_order || left.start_time.localeCompare(right.start_time)),
    [deliverySlots],
  )
  const activeCustomers = useMemo(() => commerces.filter((commerce) => commerce.active), [commerces])
  const activeProducts = useMemo(() => products.filter((product) => product.active), [products])
  const commerceById = useMemo(() => new Map(commerces.map((commerce) => [commerce.id, commerce])), [commerces])
  const visibleOrders = useMemo(() => {
    const normalizedQuery = query.trim().toLocaleLowerCase()
    return orders.filter((order) => {
      if (!statusFilterMatches(order.status, statusFilter)) return false
      if (dateFilter && order.dispatch_date !== dateFilter) return false
      if (!slotFilterMatches(order, slotFilter)) return false
      if (!normalizedQuery) return true
      return [String(order.id), order.commerce_name, order.distributor_name, order.delivery_address]
        .filter(Boolean)
        .some((value) => value.toLocaleLowerCase().includes(normalizedQuery))
    }).sort(compareOrdersForWork)
  }, [dateFilter, orders, query, slotFilter, statusFilter])
  const metrics = useMemo(
    () =>
      orders.reduce(
        (accumulator, order) => {
          accumulator.total += 1
          if (order.status === 'PENDING') accumulator.pending += 1
          if (['ACCEPTED', 'PREPARING'].includes(order.status)) accumulator.accepted += 1
          if (['SCHEDULED', 'ON_THE_WAY'].includes(order.status)) accumulator.routing += 1
          if (order.status === 'REJECTED') accumulator.rejected += 1
          if (['PENDING', 'ACCEPTED', 'PREPARING'].includes(order.status) && !order.delivery_slot) accumulator.unplanned += 1
          return accumulator
        },
        { total: 0, pending: 0, accepted: 0, routing: 0, rejected: 0, unplanned: 0 },
      ),
    [orders],
  )

  useEffect(() => {
    let disposed = false
    async function load() {
      setLoading(true)
      try {
        const [loadedOrders, loadedSlots, loadedProducts] = await Promise.all([api.orders(), api.deliverySlots(), api.products()])
        if (disposed) return
        setOrders(loadedOrders)
        setDeliverySlots(loadedSlots)
        setProducts(loadedProducts)
        void api
          .commerces()
          .then((loadedCommerces) => {
            if (!disposed) setCommerces(loadedCommerces)
          })
          .catch(() => {
            if (!disposed) showError('No pudimos cargar los datos completos de clientes.')
          })
      } catch (caught) {
        if (!disposed) showError(caught instanceof Error ? caught.message : 'No se pudieron cargar los pedidos.')
      } finally {
        if (!disposed) setLoading(false)
      }
    }
    void load()
    return () => {
      disposed = true
    }
  }, [showError])

  useEffect(() => {
    if (!selectedCustomerOrder) return
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') setSelectedCustomerOrder(null)
    }
    window.addEventListener('keydown', onKeyDown)
    return () => {
      document.body.style.overflow = previousOverflow
      window.removeEventListener('keydown', onKeyDown)
    }
  }, [selectedCustomerOrder])

  function openSchedule(order: Order) {
    const activeSlotIds = new Set(activeSlots.map((slot) => slot.id))
    const fallbackSlotId = order.delivery_slot && activeSlotIds.has(order.delivery_slot) ? order.delivery_slot : activeSlots[0]?.id ?? 0
    setActiveOrderId((current) => (current === order.id ? null : order.id))
    setDrafts((current) => ({
      ...current,
      [order.id]: {
        dispatch_date: order.dispatch_date || defaultRouteDate(),
        delivery_slot_id: fallbackSlotId,
      },
    }))
    setActionError(null)
  }

  function updateDraft(orderId: number, patch: Partial<OrderScheduleDraft>) {
    setDrafts((current) => ({
      ...current,
      [orderId]: {
        dispatch_date: current[orderId]?.dispatch_date ?? defaultRouteDate(),
        delivery_slot_id: current[orderId]?.delivery_slot_id ?? activeSlots[0]?.id ?? 0,
        ...patch,
      },
    }))
  }

  async function acceptOrder(order: Order) {
    if (isOrderRouteLocked(order)) {
      const message = routeLockMessage(order)
      setActionError(message)
      showError(message)
      return
    }
    const draft = drafts[order.id] ?? {
      dispatch_date: order.dispatch_date || defaultRouteDate(),
      delivery_slot_id: order.delivery_slot ?? activeSlots[0]?.id ?? 0,
    }
    if (!draft?.dispatch_date || !draft.delivery_slot_id) {
      setActionError('Selecciona fecha de entrega y franja para aceptar el pedido.')
      return
    }
    setSavingOrderId(order.id)
    setActionError(null)
    try {
      const updated = await api.decideOrder(order.id, {
        decision: 'ACCEPT',
        dispatch_date: draft.dispatch_date,
        delivery_slot_id: draft.delivery_slot_id,
      })
      setOrders((current) => current.map((item) => (item.id === updated.id ? updated : item)))
      setActiveOrderId(null)
      showSuccess('Pedido aceptado y coordinado.')
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : 'No se pudo aceptar el pedido.'
      setActionError(message)
      showError(message)
    } finally {
      setSavingOrderId(null)
    }
  }

  async function saveSchedule(order: Order) {
    if (isOrderRouteLocked(order)) {
      const message = routeLockMessage(order)
      setActionError(message)
      showError(message)
      return
    }
    const draft = drafts[order.id]
    if (!draft?.dispatch_date || !draft.delivery_slot_id) {
      setActionError('Selecciona fecha de entrega y franja para guardar la agenda.')
      return
    }
    setSavingOrderId(order.id)
    setActionError(null)
    try {
      const updated = await api.updateOrder(order.id, {
        dispatch_date: draft.dispatch_date,
        delivery_slot: draft.delivery_slot_id,
      })
      setOrders((current) => current.map((item) => (item.id === updated.id ? updated : item)))
      setActiveOrderId(null)
      showSuccess('Agenda de entrega actualizada.')
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : 'No se pudo guardar la agenda.'
      setActionError(message)
      showError(message)
    } finally {
      setSavingOrderId(null)
    }
  }

  async function rejectOrder(order: Order) {
    if (isOrderRouteLocked(order)) {
      const message = routeLockMessage(order)
      setActionError(message)
      showError(message)
      return
    }
    const confirmed = await confirm({
      title: 'Rechazar pedido',
      message: `El pedido #${order.id} quedara rechazado y se liberara el stock reservado.`,
      confirmLabel: 'Rechazar',
      cancelLabel: 'Cancelar',
      tone: 'danger',
    })
    if (!confirmed) return
    setSavingOrderId(order.id)
    setActionError(null)
    try {
      const updated = await api.decideOrder(order.id, { decision: 'REJECT' })
      setOrders((current) => current.map((item) => (item.id === updated.id ? updated : item)))
      setActiveOrderId(null)
      showSuccess('Pedido rechazado.')
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : 'No se pudo rechazar el pedido.'
      setActionError(message)
      showError(message)
    } finally {
      setSavingOrderId(null)
    }
  }

  async function createManualOrder(payload: ManualOrderPayload) {
    setManualOrderSaving(true)
    setManualOrderError(null)
    try {
      const created = await api.createOrder(payload)
      setOrders((current) => [created, ...current])
      setManualOrderOpen(false)
      setStatusFilter('IN_PROGRESS')
      setDateFilter(created.dispatch_date)
      setSlotFilter(created.delivery_slot ? String(created.delivery_slot) : 'ALL')
      showSuccess('Pedido manual creado y listo para ruteo.')
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : 'No se pudo crear el pedido manual.'
      setManualOrderError(message)
      showError(message)
    } finally {
      setManualOrderSaving(false)
    }
  }

  return (
    <section className="grid gap-5">
      <div className="grid gap-4 border-b border-slate-200 pb-5 xl:grid-cols-[minmax(0,1fr)_auto] xl:items-end">
        <div className="max-w-3xl">
          <p className="text-xs font-800 uppercase tracking-[0.14em] text-brand-700">Distribuidora</p>
          <h1 className="mt-1 text-2xl font-800 text-slate-950">Pedidos de distribuidora</h1>
          <button
            className="mt-3 inline-flex min-h-11 items-center gap-2 rounded-md bg-brand-600 px-4 text-sm font-800 text-white transition hover:bg-brand-700 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:ring-offset-2"
            type="button"
            onClick={() => {
              setManualOrderError(null)
              setManualOrderOpen(true)
            }}
          >
            <Icon name="plus" className="h-4 w-4" />
            Crear pedido
          </button>
        </div>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
          <OrderMetric active={statusFilter === 'ALL'} label="Total" value={metrics.total} onClick={() => setStatusFilter('ALL')} />
          <OrderMetric active={statusFilter === 'PENDING'} label="Pendientes" value={metrics.pending} tone="urgent" onClick={() => setStatusFilter('PENDING')} />
          <OrderMetric active={statusFilter === 'IN_PROGRESS'} label="Aceptados" value={metrics.accepted} onClick={() => setStatusFilter('IN_PROGRESS')} />
          <OrderMetric active={statusFilter === 'ROUTING'} label="En reparto" value={metrics.routing} onClick={() => setStatusFilter('ROUTING')} />
          <OrderMetric label="Sin franja" value={metrics.unplanned} tone="warning" onClick={() => setSlotFilter('NONE')} />
        </div>
      </div>

      <section className="grid gap-3 rounded-lg border border-slate-200 bg-white p-4 shadow-soft">
        <div className="flex flex-wrap gap-2">
          {orderStatusFilterOptions.map((option) => (
            <button
              key={option.id}
              className={`min-h-10 rounded-md border px-3 text-sm font-800 transition ${
                statusFilter === option.id ? 'border-brand-600 bg-brand-50 text-brand-700' : 'border-slate-200 bg-white text-slate-600 hover:border-brand-300 hover:text-brand-700'
              }`}
              type="button"
              aria-pressed={statusFilter === option.id}
              onClick={() => setStatusFilter(option.id)}
            >
              {option.label} <span className="text-xs font-800 text-slate-400">{countOrdersByStatusFilter(orders, option.id)}</span>
            </button>
          ))}
        </div>

        <div className="grid gap-3 lg:grid-cols-[11rem_11rem_11rem_minmax(0,1fr)] lg:items-end">
          <label className="grid gap-1 text-sm font-700 text-slate-700">
            Estado
            <select className="min-h-11 rounded-md border border-slate-300 bg-white px-3" value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>
              {orderStatusFilterOptions.map((option) => (
                <option key={option.id} value={option.id}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
          <label className="grid gap-1 text-sm font-700 text-slate-700">
            Fecha de entrega
            <input className="min-h-11 rounded-md border border-slate-300 px-3" type="date" value={dateFilter} onChange={(event) => setDateFilter(event.target.value)} />
          </label>
          <label className="grid gap-1 text-sm font-700 text-slate-700">
            Franja
            <select className="min-h-11 rounded-md border border-slate-300 bg-white px-3" value={slotFilter} onChange={(event) => setSlotFilter(event.target.value)}>
              <option value="ALL">Todas</option>
              <option value="NONE">Sin franja</option>
              {activeSlots.map((slot) => (
                <option key={slot.id} value={slot.id}>
                  {deliverySlotLabel(slot)}
                </option>
              ))}
            </select>
          </label>
          <label className="grid gap-1 text-sm font-700 text-slate-700">
            Cliente o pedido
            <input
              className="min-h-11 rounded-md border border-slate-300 px-3"
              type="search"
              value={query}
              placeholder="Buscar por cliente, direccion o numero"
              onChange={(event) => setQuery(event.target.value)}
            />
          </label>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 pt-3">
          <p className="text-sm font-700 text-slate-500">
            Mostrando {visibleOrders.length} de {orders.length} pedidos. Ordenados por accion pendiente.
          </p>
          <div className="flex flex-wrap gap-2">
            <button className="min-h-10 rounded-md border border-slate-200 px-3 text-sm font-800 text-slate-600 transition hover:border-brand-300 hover:text-brand-700" type="button" onClick={() => setDateFilter(addDaysIso(0))}>
              Hoy
            </button>
            <button className="min-h-10 rounded-md border border-slate-200 px-3 text-sm font-800 text-slate-600 transition hover:border-brand-300 hover:text-brand-700" type="button" onClick={() => setDateFilter(addDaysIso(1))}>
              Maniana
            </button>
            <button
              className="min-h-10 rounded-md border border-slate-200 px-3 text-sm font-800 text-slate-600 transition hover:border-brand-300 hover:text-brand-700"
              type="button"
              onClick={() => {
                setStatusFilter('ALL')
                setSlotFilter('ALL')
                setDateFilter('')
                setQuery('')
              }}
            >
              Limpiar filtros
            </button>
          </div>
        </div>
        {activeSlots.length === 0 ? (
          <p className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm font-700 text-amber-900">
            Sin franjas activas.
          </p>
        ) : null}
      </section>

      {loading ? (
        <div className="rounded-lg border border-slate-200 bg-white p-6 text-sm font-700 text-slate-600">Cargando pedidos...</div>
      ) : visibleOrders.length === 0 ? (
        <EmptyState title="Sin pedidos" />
      ) : (
        <section className="grid gap-3">
          <div className="hidden rounded-lg border border-slate-200 bg-slate-900 px-4 py-3 text-xs font-800 uppercase tracking-[0.08em] text-slate-300 shadow-soft lg:grid lg:grid-cols-[minmax(12rem,0.9fr)_minmax(16rem,1.25fr)_minmax(13rem,0.9fr)_minmax(17rem,1.1fr)] lg:gap-4">
            <span>Pedido y cliente</span>
            <span>Articulos</span>
            <span>Entrega y total</span>
            <span>Gestion</span>
          </div>
          {visibleOrders.map((order) => (
            <OrderWorkRow
              key={order.id}
              active={activeOrderId === order.id}
              activeSlots={activeSlots}
              customer={commerceById.get(order.commerce) ?? null}
              draft={drafts[order.id]}
              error={activeOrderId === order.id ? actionError : null}
              order={order}
              saving={savingOrderId === order.id}
              onAccept={() => void acceptOrder(order)}
              onCustomerClick={() => setSelectedCustomerOrder(order)}
              onOpen={() => openSchedule(order)}
              onReject={() => void rejectOrder(order)}
              onSaveSchedule={() => void saveSchedule(order)}
              onUpdateDraft={(patch) => updateDraft(order.id, patch)}
            />
          ))}
        </section>
      )}
      {selectedCustomerOrder ? (
        <CustomerSummaryModal
          order={selectedCustomerOrder}
          customer={commerceById.get(selectedCustomerOrder.commerce) ?? null}
          onClose={() => setSelectedCustomerOrder(null)}
        />
      ) : null}
      {manualOrderOpen ? (
        <ManualOrderModal
          activeSlots={activeSlots}
          customers={activeCustomers}
          error={manualOrderError}
          products={activeProducts}
          saving={manualOrderSaving}
          onClose={() => setManualOrderOpen(false)}
          onSubmit={(payload) => void createManualOrder(payload)}
        />
      ) : null}
    </section>
  )
}

function OrderWorkRow({
  order,
  customer,
  active,
  draft,
  activeSlots,
  saving,
  error,
  onCustomerClick,
  onOpen,
  onUpdateDraft,
  onAccept,
  onReject,
  onSaveSchedule,
}: {
  order: Order
  customer: Commerce | null
  active: boolean
  draft: OrderScheduleDraft | undefined
  activeSlots: DistributorDeliverySlot[]
  saving: boolean
  error: string | null
  onCustomerClick: () => void
  onOpen: () => void
  onUpdateDraft: (patch: Partial<OrderScheduleDraft>) => void
  onAccept: () => void
  onReject: () => void
  onSaveSchedule: () => void
}) {
  return (
    <article className="rounded-lg border border-slate-200 bg-white p-4 shadow-soft transition hover:border-brand-300">
      <div className="grid gap-4 lg:grid-cols-[minmax(12rem,0.9fr)_minmax(16rem,1.25fr)_minmax(13rem,0.9fr)_minmax(17rem,1.1fr)] lg:items-start">
        <section className="min-w-0">
          <div className="flex items-start justify-between gap-3 lg:block">
            <div className="min-w-0">
              <p className="text-xs font-800 uppercase text-slate-500">Pedido #{order.id}</p>
              <button
                className="mt-1 line-clamp-2 text-left text-lg font-800 text-slate-950 underline decoration-slate-300 underline-offset-4 transition hover:text-brand-700 hover:decoration-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:ring-offset-2"
                type="button"
                onClick={onCustomerClick}
                aria-label={`Ver datos del cliente ${order.commerce_name}`}
              >
                {order.commerce_name}
              </button>
            </div>
            <div className="shrink-0 lg:mt-3">
              <StatusBadge status={order.status} />
            </div>
          </div>
          <p className="mt-3 line-clamp-2 text-sm font-700 leading-6 text-slate-500">{order.delivery_address}</p>
          <OrderDeliveryFlags customer={customer} order={order} />
        </section>

        <section className="min-w-0 border-t border-slate-100 pt-3 lg:border-t-0 lg:pt-0">
          <p className="mb-2 text-xs font-800 uppercase text-slate-500 lg:hidden">Articulos</p>
          <OrderItemsList order={order} />
        </section>

        <section className="grid gap-2 border-t border-slate-100 pt-3 text-sm lg:border-t-0 lg:pt-0">
          <p className="text-xs font-800 uppercase text-slate-500 lg:hidden">Entrega y total</p>
          <div className="rounded-md bg-slate-50 px-3 py-2">
            <p className="text-[11px] font-800 uppercase text-slate-500">Entrega</p>
            <p className="mt-1 font-800 text-slate-950">{formatOrderDate(order.dispatch_date)}</p>
            <p className="mt-1 text-slate-600">{deliverySlotSummary(order)}</p>
          </div>
          <div className="rounded-md bg-brand-50 px-3 py-2">
            <p className="text-[11px] font-800 uppercase text-brand-700">Total</p>
            <p className="mt-1 text-lg font-800 text-slate-950">{formatMoney(order.total)}</p>
          </div>
        </section>

        <section className="border-t border-slate-100 pt-3 lg:border-t-0 lg:pt-0">
          <p className="mb-2 text-xs font-800 uppercase text-slate-500 lg:hidden">Gestion</p>
          <OrderDecisionControls
            active={active}
            activeSlots={activeSlots}
            draft={draft}
            error={error}
            order={order}
            saving={saving}
            onAccept={onAccept}
            onOpen={onOpen}
            onReject={onReject}
            onSaveSchedule={onSaveSchedule}
            onUpdateDraft={onUpdateDraft}
          />
        </section>
      </div>
    </article>
  )
}

function OrderMetric({
  label,
  value,
  active = false,
  tone = 'neutral',
  onClick,
}: {
  label: string
  value: number
  active?: boolean
  tone?: 'neutral' | 'urgent' | 'warning'
  onClick: () => void
}) {
  const toneClass =
    tone === 'urgent'
      ? 'text-red-700'
      : tone === 'warning'
        ? 'text-amber-800'
        : 'text-slate-950'
  return (
    <button
      className={`min-h-16 rounded-md border bg-white px-3 py-2 text-right transition hover:border-brand-300 hover:bg-brand-50 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:ring-offset-2 ${
        active ? 'border-brand-500 bg-brand-50' : 'border-slate-200'
      }`}
      type="button"
      onClick={onClick}
    >
      <p className="text-[11px] font-800 uppercase text-slate-500">{label}</p>
      <p className={`text-lg font-800 ${toneClass}`}>{value}</p>
    </button>
  )
}

function CustomerSummaryModal({ order, customer, onClose }: { order: Order; customer: Commerce | null; onClose: () => void }) {
  const title = customer?.trade_name || order.commerce_name
  const closeButtonRef = useRef<HTMLButtonElement | null>(null)

  useEffect(() => {
    closeButtonRef.current?.focus()
  }, [])

  return (
    <div
      className="fixed inset-0 z-[1300] grid place-items-end bg-slate-950/50 p-0 sm:place-items-center sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="customer-summary-title"
      onClick={onClose}
    >
      <section
        className="max-h-dvh w-full overflow-y-auto rounded-t-lg border border-slate-200 bg-white p-4 shadow-[0_36px_80px_-32px_rgba(15,23,42,0.45)] sm:max-h-[92dvh] sm:max-w-2xl sm:rounded-lg sm:p-5"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4 border-b border-slate-200 pb-4">
          <div className="min-w-0">
            <p className="text-xs font-800 uppercase text-slate-500">Cliente</p>
            <h2 id="customer-summary-title" className="mt-1 break-words text-xl font-800 text-slate-950">
              {title}
            </h2>
          </div>
          <button
            ref={closeButtonRef}
            className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-md border border-slate-300 px-3 text-sm font-800 text-slate-700 transition hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:ring-offset-2"
            type="button"
            onClick={onClose}
            aria-label="Cerrar datos del cliente"
          >
            X
          </button>
        </div>

        <div className="mt-4 grid gap-4">
          <section className="rounded-lg border border-slate-200 p-3">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <h3 className="font-800 text-slate-950">Datos comerciales</h3>
              {customer ? (
                <span className={`rounded-md px-2 py-1 text-xs font-800 ${customer.active ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-600'}`}>
                  {customer.active ? 'Activo' : 'Inactivo'}
                </span>
              ) : null}
            </div>
            <dl className="mt-3 grid gap-3 sm:grid-cols-2">
              <CustomerInfoRow label="Nombre comercial" value={title} />
              <CustomerInfoRow label="Razon social" value={customer?.legal_name} />
              <CustomerInfoRow label="CUIT" value={customer?.tax_id} />
              <CustomerInfoRow label="Distribuidora" value={order.distributor_name} />
            </dl>
          </section>

          <section className="rounded-lg border border-slate-200 p-3">
            <h3 className="font-800 text-slate-950">Contacto</h3>
            <dl className="mt-3 grid gap-3 sm:grid-cols-2">
              <CustomerInfoRow label="Contacto" value={customer?.contact_name} />
              <CustomerInfoRow label="Email" value={customer?.email} />
              <CustomerInfoRow label="Telefono" value={customer?.phone} />
              <CustomerInfoRow label="Notas de entrega" value={customer?.delivery_notes} />
            </dl>
          </section>

          <section className="rounded-lg border border-slate-200 p-3">
            <h3 className="font-800 text-slate-950">Entrega</h3>
            <dl className="mt-3 grid gap-3 sm:grid-cols-2">
              <CustomerInfoRow label="Direccion cliente" value={formatCustomerAddress(customer, order)} />
              <CustomerInfoRow label="Codigo postal" value={customer?.postal_code} />
              <CustomerInfoRow label="Coordenadas" value={customerCoordinates(customer, order)} />
              <CustomerInfoRow label="Ventana habitual" value={windowRangeLabel(customer?.default_window_start, customer?.default_window_end)} />
              <CustomerInfoRow label="Entrega del pedido" value={`${formatOrderDate(order.dispatch_date)} - ${deliverySlotSummary(order)}`} />
              <CustomerInfoRow label="Estado pedido" value={statusLabel(order.status)} />
            </dl>
          </section>
        </div>
      </section>
    </div>
  )
}

function CustomerInfoRow({ label, value }: { label: string; value: string | number | null | undefined }) {
  return (
    <div className="grid gap-1">
      <dt className="text-[11px] font-800 uppercase text-slate-500">{label}</dt>
      <dd className="break-words text-sm font-700 leading-6 text-slate-900">{displayValue(value)}</dd>
    </div>
  )
}

function ManualOrderModal({
  customers,
  products,
  activeSlots,
  saving,
  error,
  onClose,
  onSubmit,
}: {
  customers: Commerce[]
  products: Product[]
  activeSlots: DistributorDeliverySlot[]
  saving: boolean
  error: string | null
  onClose: () => void
  onSubmit: (payload: ManualOrderPayload) => void
}) {
  const closeButtonRef = useRef<HTMLButtonElement | null>(null)
  const [customerQuery, setCustomerQuery] = useState('')
  const [commerceId, setCommerceId] = useState<number | ''>('')
  const [dispatchDate, setDispatchDate] = useState(defaultRouteDate())
  const [deliverySlotId, setDeliverySlotId] = useState<number | ''>(activeSlots[0]?.id ?? '')
  const [notes, setNotes] = useState('')
  const [productQuery, setProductQuery] = useState('')
  const [selectedProductId, setSelectedProductId] = useState<number | ''>('')
  const [quantity, setQuantity] = useState('1')
  const [lines, setLines] = useState<ManualOrderLineDraft[]>([])
  const [localError, setLocalError] = useState<string | null>(null)
  const productById = useMemo(() => new Map(products.map((product) => [product.id, product])), [products])
  const selectedProduct = selectedProductId ? productById.get(selectedProductId) ?? null : null
  const normalizedCustomerQuery = customerQuery.trim().toLocaleLowerCase()
  const normalizedProductQuery = productQuery.trim().toLocaleLowerCase()
  const filteredCustomers = customers.filter((customer) => {
    if (!normalizedCustomerQuery) return true
    return [customer.trade_name, customer.legal_name, customer.tax_id, customer.contact_name, customer.address]
      .filter(Boolean)
      .some((value) => value.toLocaleLowerCase().includes(normalizedCustomerQuery))
  })
  const filteredProducts = products.filter((product) => {
    if (!normalizedProductQuery) return true
    return [product.name, product.sku, product.brand, product.category, product.subcategory]
      .filter(Boolean)
      .some((value) => value.toLocaleLowerCase().includes(normalizedProductQuery))
  })
  const total = lines.reduce((sum, line) => {
    const product = productById.get(line.productId)
    return sum + Number(product?.price ?? 0) * Number(line.quantity || 0)
  }, 0)
  const totalUnits = lines.reduce((sum, line) => sum + Number(line.quantity || 0), 0)

  useEffect(() => {
    closeButtonRef.current?.focus()
  }, [])

  useEffect(() => {
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => {
      document.body.style.overflow = previousOverflow
      window.removeEventListener('keydown', onKeyDown)
    }
  }, [onClose])

  useEffect(() => {
    if (!deliverySlotId && activeSlots[0]) setDeliverySlotId(activeSlots[0].id)
  }, [activeSlots, deliverySlotId])

  function addLine() {
    if (!selectedProduct) {
      setLocalError('Selecciona un articulo.')
      return
    }
    const nextQuantity = Number(quantity)
    if (!Number.isFinite(nextQuantity) || nextQuantity <= 0) {
      setLocalError('Ingresa una cantidad mayor a cero.')
      return
    }
    const available = productAvailable(selectedProduct)
    const currentQuantity = Number(lines.find((line) => line.productId === selectedProduct.id)?.quantity ?? 0)
    if (available <= 0 || currentQuantity + nextQuantity > available) {
      setLocalError(`Stock disponible para ${selectedProduct.name}: ${formatQuantity(available)}.`)
      return
    }
    setLines((current) => {
      const existing = current.find((line) => line.productId === selectedProduct.id)
      if (existing) {
        return current.map((line) =>
          line.productId === selectedProduct.id
            ? { ...line, quantity: trimQuantity(currentQuantity + nextQuantity) }
            : line,
        )
      }
      return [...current, { productId: selectedProduct.id, quantity: trimQuantity(nextQuantity) }]
    })
    setSelectedProductId('')
    setQuantity('1')
    setLocalError(null)
  }

  function updateLineQuantity(productId: number, value: string) {
    const product = productById.get(productId)
    const nextQuantity = Number(value)
    if (product && Number.isFinite(nextQuantity) && nextQuantity > productAvailable(product)) {
      setLocalError(`Stock disponible para ${product.name}: ${formatQuantity(productAvailable(product))}.`)
    } else {
      setLocalError(null)
    }
    setLines((current) => current.map((line) => (line.productId === productId ? { ...line, quantity: value } : line)))
  }

  function removeLine(productId: number) {
    setLines((current) => current.filter((line) => line.productId !== productId))
    setLocalError(null)
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!commerceId) {
      setLocalError('Selecciona un cliente registrado.')
      return
    }
    if (!dispatchDate) {
      setLocalError('Selecciona la fecha de entrega.')
      return
    }
    if (!deliverySlotId) {
      setLocalError('Selecciona una franja horaria.')
      return
    }
    if (lines.length === 0) {
      setLocalError('Agrega al menos un articulo.')
      return
    }
    const invalidLine = lines.find((line) => {
      const product = productById.get(line.productId)
      const nextQuantity = Number(line.quantity)
      return !product || !Number.isFinite(nextQuantity) || nextQuantity <= 0 || nextQuantity > productAvailable(product)
    })
    if (invalidLine) {
      setLocalError('Revisa las cantidades antes de crear el pedido.')
      return
    }
    setLocalError(null)
    onSubmit({
      commerce: Number(commerceId),
      dispatch_date: dispatchDate,
      delivery_slot: Number(deliverySlotId),
      notes,
      line_items: lines.map((line) => ({ product_id: line.productId, quantity: line.quantity })),
    })
  }

  return (
    <div
      className="fixed inset-0 z-[1300] grid place-items-end bg-slate-950/50 p-0 sm:place-items-center sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="manual-order-title"
      onClick={onClose}
    >
      <form
        className="max-h-dvh w-full overflow-y-auto rounded-t-lg border border-slate-200 bg-white shadow-[0_36px_80px_-32px_rgba(15,23,42,0.45)] sm:max-h-[92dvh] sm:max-w-5xl sm:rounded-lg"
        onClick={(event) => event.stopPropagation()}
        onSubmit={submit}
      >
        <header className="flex items-start justify-between gap-4 border-b border-slate-200 p-4 sm:p-5">
          <div className="min-w-0">
            <p className="text-xs font-800 uppercase tracking-[0.12em] text-brand-700">Pedido manual</p>
            <h2 id="manual-order-title" className="mt-1 text-xl font-800 text-slate-950">
              Crear pedido manual
            </h2>
            <p className="mt-1 text-sm font-700 text-slate-500">Queda aceptado para entrar al ruteo de la fecha y franja elegidas.</p>
          </div>
          <button
            ref={closeButtonRef}
            className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-md border border-slate-300 text-slate-700 transition hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:ring-offset-2"
            type="button"
            onClick={onClose}
            aria-label="Cerrar pedido manual"
          >
            <Icon name="close" className="h-5 w-5" />
          </button>
        </header>

        <div className="grid gap-4 p-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)_20rem] sm:p-5">
          <section className="grid content-start gap-4">
            <div>
              <h3 className="text-sm font-800 text-slate-950">Cliente y entrega</h3>
              <p className="mt-1 text-xs font-700 text-slate-500">{customers.length} clientes registrados</p>
            </div>
            <label className="grid gap-1 text-sm font-700 text-slate-700">
              Buscar cliente
              <input
                className="min-h-11 rounded-md border border-slate-300 px-3"
                type="search"
                value={customerQuery}
                placeholder="Nombre, CUIT o direccion"
                onChange={(event) => setCustomerQuery(event.target.value)}
              />
            </label>
            <label className="grid gap-1 text-sm font-700 text-slate-700">
              Cliente
              <select
                className="min-h-11 rounded-md border border-slate-300 bg-white px-3"
                value={commerceId}
                onChange={(event) => setCommerceId(event.target.value ? Number(event.target.value) : '')}
              >
                <option value="">Seleccionar cliente</option>
                {filteredCustomers.map((customer) => (
                  <option key={customer.id} value={customer.id} disabled={!customerCanReceiveOrder(customer)}>
                    {customer.trade_name}{customerCanReceiveOrder(customer) ? '' : ' - sin coordenadas'}
                  </option>
                ))}
              </select>
            </label>
            {customers.length === 0 ? (
              <p className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-800 text-amber-900">No hay clientes activos cargados.</p>
            ) : null}
            <label className="grid gap-1 text-sm font-700 text-slate-700">
              Fecha de entrega
              <input className="min-h-11 rounded-md border border-slate-300 px-3" type="date" value={dispatchDate} onChange={(event) => setDispatchDate(event.target.value)} />
            </label>
            <div className="flex flex-wrap gap-2">
              <button className="min-h-9 rounded-md border border-slate-200 bg-white px-3 text-xs font-800 text-slate-600 transition hover:border-brand-300 hover:text-brand-700" type="button" onClick={() => setDispatchDate(addDaysIso(0))}>
                Hoy
              </button>
              <button className="min-h-9 rounded-md border border-slate-200 bg-white px-3 text-xs font-800 text-slate-600 transition hover:border-brand-300 hover:text-brand-700" type="button" onClick={() => setDispatchDate(addDaysIso(1))}>
                Maniana
              </button>
            </div>
            <label className="grid gap-1 text-sm font-700 text-slate-700">
              Franja horaria
              <select
                className="min-h-11 rounded-md border border-slate-300 bg-white px-3"
                value={deliverySlotId}
                onChange={(event) => setDeliverySlotId(event.target.value ? Number(event.target.value) : '')}
              >
                <option value="">Seleccionar franja</option>
                {activeSlots.map((slot) => (
                  <option key={slot.id} value={slot.id}>
                    {deliverySlotLabel(slot)}
                  </option>
                ))}
              </select>
            </label>
            {activeSlots.length === 0 ? (
              <p className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-800 text-amber-900">Carga una franja activa antes de crear pedidos manuales.</p>
            ) : null}
          </section>

          <section className="grid content-start gap-4">
            <div>
              <h3 className="text-sm font-800 text-slate-950">Articulos</h3>
              <p className="mt-1 text-xs font-700 text-slate-500">{products.length} articulos activos</p>
            </div>
            <label className="grid gap-1 text-sm font-700 text-slate-700">
              Buscar articulo
              <input
                className="min-h-11 rounded-md border border-slate-300 px-3"
                type="search"
                value={productQuery}
                placeholder="Nombre, SKU, marca o categoria"
                onChange={(event) => setProductQuery(event.target.value)}
              />
            </label>
            <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_8rem_auto] sm:items-end">
              <label className="grid gap-1 text-sm font-700 text-slate-700">
                Articulo
                <select
                  className="min-h-11 rounded-md border border-slate-300 bg-white px-3"
                  value={selectedProductId}
                  onChange={(event) => setSelectedProductId(event.target.value ? Number(event.target.value) : '')}
                >
                  <option value="">Seleccionar articulo</option>
                  {filteredProducts.slice(0, 80).map((product) => (
                    <option key={product.id} value={product.id} disabled={productAvailable(product) <= 0}>
                      {product.sku ? `${product.sku} - ` : ''}{product.name} - disp. {formatQuantity(productAvailable(product))}
                    </option>
                  ))}
                </select>
              </label>
              <label className="grid gap-1 text-sm font-700 text-slate-700">
                Cantidad
                <input
                  className="min-h-11 rounded-md border border-slate-300 px-3"
                  type="number"
                  min="0.001"
                  step="0.001"
                  max={selectedProduct ? productAvailable(selectedProduct) : undefined}
                  value={quantity}
                  onChange={(event) => setQuantity(event.target.value)}
                />
              </label>
              <button className="min-h-11 rounded-md border border-brand-200 px-4 text-sm font-800 text-brand-700 transition hover:bg-brand-50" type="button" onClick={addLine}>
                Agregar
              </button>
            </div>

            <div className="grid gap-2">
              {lines.length === 0 ? (
                <p className="rounded-md border border-dashed border-slate-300 px-3 py-4 text-sm font-700 text-slate-500">Sin articulos seleccionados.</p>
              ) : (
                lines.map((line) => {
                  const product = productById.get(line.productId)
                  if (!product) return null
                  return (
                    <div key={line.productId} className="grid gap-3 rounded-md border border-slate-200 p-3 sm:grid-cols-[minmax(0,1fr)_7rem_auto] sm:items-center">
                      <div className="min-w-0">
                        <p className="break-words text-sm font-800 text-slate-950">{product.name}</p>
                        <p className="mt-1 text-xs font-700 text-slate-500">
                          {product.sku ? `SKU ${product.sku} - ` : ''}{formatMoney(product.price)} por {product.unit || 'unidad'}
                        </p>
                      </div>
                      <label className="grid gap-1 text-xs font-800 text-slate-600">
                        Cantidad
                        <input
                          className="min-h-10 rounded-md border border-slate-300 px-3 text-sm"
                          type="number"
                          min="0.001"
                          step="0.001"
                          max={productAvailable(product)}
                          value={line.quantity}
                          aria-label={`Cantidad ${product.name}`}
                          onChange={(event) => updateLineQuantity(line.productId, event.target.value)}
                        />
                      </label>
                      <button className="min-h-10 rounded-md border border-red-200 px-3 text-xs font-800 text-red-700" type="button" onClick={() => removeLine(line.productId)}>
                        Quitar
                      </button>
                    </div>
                  )
                })
              )}
            </div>
          </section>

          <aside className="grid content-start gap-4 rounded-lg border border-slate-200 bg-slate-50 p-4">
            <h3 className="text-sm font-800 text-slate-950">Resumen</h3>
            <dl className="grid gap-3 text-sm">
              <div className="flex items-center justify-between gap-3">
                <dt className="font-700 text-slate-500">Articulos</dt>
                <dd className="font-800 text-slate-950">{lines.length}</dd>
              </div>
              <div className="flex items-center justify-between gap-3">
                <dt className="font-700 text-slate-500">Unidades</dt>
                <dd className="font-800 text-slate-950">{formatQuantity(totalUnits)}</dd>
              </div>
              <div className="flex items-center justify-between gap-3 border-t border-slate-200 pt-3">
                <dt className="font-800 text-slate-700">Total estimado</dt>
                <dd className="text-lg font-800 text-slate-950">{formatMoney(total)}</dd>
              </div>
            </dl>
            <label className="grid gap-1 text-sm font-700 text-slate-700">
              Notas
              <textarea className="min-h-28 rounded-md border border-slate-300 bg-white px-3 py-2" value={notes} onChange={(event) => setNotes(event.target.value)} />
            </label>
            {localError || error ? (
              <p className="rounded-md border border-red-200 bg-white px-3 py-2 text-xs font-800 text-red-700" role="alert">
                {localError || error}
              </p>
            ) : null}
            <button className="min-h-12 rounded-md bg-brand-600 px-4 text-sm font-800 text-white disabled:bg-slate-300 disabled:text-slate-600" type="submit" disabled={saving}>
              {saving ? 'Creando...' : 'Crear pedido manual'}
            </button>
          </aside>
        </div>
      </form>
    </div>
  )
}

function OrderDeliveryFlags({ order, customer }: { order: Order; customer: Commerce | null }) {
  const flags = [
    isOrderRouteLocked(order) ? `En ${order.route_lock_label || 'HR'}` : '',
    !order.dispatch_date ? 'Sin fecha' : '',
    !order.delivery_slot && !order.delivery_slot_name ? 'Sin franja' : '',
    !((customer?.latitude && customer?.longitude) || (order.delivery_latitude && order.delivery_longitude)) ? 'Sin coordenadas' : '',
    customer?.delivery_notes ? 'Con notas' : '',
  ].filter(Boolean)

  if (flags.length === 0) return null

  return (
    <div className="mt-2 flex flex-wrap gap-1.5">
      {flags.map((flag) => (
        <span key={flag} className="rounded-md border border-amber-200 bg-amber-50 px-2 py-1 text-[11px] font-800 text-amber-900">
          {flag}
        </span>
      ))}
    </div>
  )
}

function OrderItemsList({ order }: { order: Order }) {
  if (order.items.length === 0) {
    return <p className="rounded-md border border-dashed border-slate-300 px-3 py-2 text-sm font-700 text-slate-500">Sin articulos cargados.</p>
  }
  const previewItems = order.items.slice(0, 2)
  const remainingItems = order.items.length - previewItems.length
  const totalQuantity = order.items.reduce((total, item) => total + Number(item.quantity ?? 0), 0)

  return (
    <div className="grid gap-2">
      <div className="flex flex-wrap items-center justify-between gap-2 text-xs font-800 text-slate-500">
        <span>{order.items.length} articulos</span>
        <span>{formatQuantity(totalQuantity)} unidades</span>
      </div>
      {previewItems.map((item) => (
        <div key={item.id} className="grid gap-1 rounded-md bg-slate-50 px-3 py-2">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <p className="font-800 text-slate-950">{item.product_name}</p>
            <p className="text-xs font-800 text-slate-600">{formatMoney(item.subtotal)}</p>
          </div>
          <p className="text-xs font-700 text-slate-500">
            {item.sku ? `SKU ${item.sku} - ` : ''}{formatQuantity(item.quantity)} u. x {formatMoney(item.price)}
          </p>
        </div>
      ))}
      {remainingItems > 0 ? (
        <p className="rounded-md border border-slate-200 px-3 py-2 text-xs font-800 text-slate-500">
          +{remainingItems} articulos mas.
        </p>
      ) : null}
    </div>
  )
}

function OrderDecisionControls({
  order,
  active,
  draft,
  activeSlots,
  saving,
  error,
  onOpen,
  onUpdateDraft,
  onAccept,
  onReject,
  onSaveSchedule,
}: {
  order: Order
  active: boolean
  draft: OrderScheduleDraft | undefined
  activeSlots: DistributorDeliverySlot[]
  saving: boolean
  error: string | null
  onOpen: () => void
  onUpdateDraft: (patch: Partial<OrderScheduleDraft>) => void
  onAccept: () => void
  onReject: () => void
  onSaveSchedule: () => void
}) {
  const canDecide = order.status === 'PENDING'
  const canAdjust = ['ACCEPTED', 'PREPARING'].includes(order.status)
  const routeLocked = isOrderRouteLocked(order)
  const hasReadySchedule = Boolean(order.dispatch_date && order.delivery_slot)
  const controlsDisabled = saving || activeSlots.length === 0 || routeLocked

  if (routeLocked) {
    return <p className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-800 text-amber-900">{routeLockMessage(order)}</p>
  }

  if (!canDecide && !canAdjust) {
    return <p className="rounded-md bg-slate-50 px-3 py-2 text-xs font-700 text-slate-500">Sin acciones comerciales para este estado.</p>
  }

  return (
    <div className="grid gap-2">
      <div className="flex flex-wrap gap-2">
        {canDecide && hasReadySchedule && !active ? (
          <button className="min-h-11 rounded-md bg-brand-600 px-4 text-sm font-800 text-white disabled:opacity-60" type="button" disabled={saving} onClick={onAccept}>
            Aceptar para {formatOrderDate(order.dispatch_date)}
          </button>
        ) : null}
        <button className="min-h-11 rounded-md bg-slate-950 px-4 text-sm font-800 text-white disabled:opacity-60" type="button" disabled={activeSlots.length === 0} onClick={onOpen}>
          {active ? 'Cerrar' : canDecide && hasReadySchedule ? 'Cambiar entrega' : canDecide ? 'Aceptar pedido' : 'Ajustar entrega'}
        </button>
        {canDecide ? (
          <button className="min-h-11 rounded-md border border-red-200 px-4 text-sm font-800 text-red-700 disabled:opacity-60" type="button" disabled={saving} onClick={onReject}>
            Rechazar
          </button>
        ) : null}
      </div>

      {active ? (
        <div className="grid gap-2 rounded-md border border-slate-200 bg-slate-50 p-3">
          <label className="grid gap-1 text-xs font-800 text-slate-600">
            Fecha de entrega
            <input
              className="min-h-11 rounded-md border border-slate-300 bg-white px-3 text-sm font-700 text-slate-800"
              type="date"
              value={draft?.dispatch_date ?? ''}
              onChange={(event) => onUpdateDraft({ dispatch_date: event.target.value })}
            />
          </label>
          <div className="flex flex-wrap gap-2">
            <button className="min-h-9 rounded-md border border-slate-200 bg-white px-3 text-xs font-800 text-slate-600 transition hover:border-brand-300 hover:text-brand-700" type="button" onClick={() => onUpdateDraft({ dispatch_date: addDaysIso(0) })}>
              Hoy
            </button>
            <button className="min-h-9 rounded-md border border-slate-200 bg-white px-3 text-xs font-800 text-slate-600 transition hover:border-brand-300 hover:text-brand-700" type="button" onClick={() => onUpdateDraft({ dispatch_date: addDaysIso(1) })}>
              Maniana
            </button>
          </div>
          <label className="grid gap-1 text-xs font-800 text-slate-600">
            Franja horaria
            <select
              className="min-h-11 rounded-md border border-slate-300 bg-white px-3 text-sm font-700 text-slate-800"
              value={draft?.delivery_slot_id || ''}
              onChange={(event) => onUpdateDraft({ delivery_slot_id: Number(event.target.value) })}
            >
              <option value="">Seleccionar franja</option>
              {activeSlots.map((slot) => (
                <option key={slot.id} value={slot.id}>
                  {deliverySlotLabel(slot)}
                </option>
              ))}
            </select>
          </label>
          {error ? <p className="rounded-md border border-red-200 bg-white px-3 py-2 text-xs font-800 text-red-700">{error}</p> : null}
          <button
            className="min-h-11 rounded-md bg-brand-600 px-4 text-sm font-800 text-white disabled:opacity-60"
            type="button"
            disabled={controlsDisabled}
            onClick={canDecide ? onAccept : onSaveSchedule}
          >
            {saving ? 'Guardando...' : canDecide ? 'Confirmar aceptacion' : 'Guardar entrega'}
          </button>
        </div>
      ) : null}
    </div>
  )
}

export function DashboardRoutingPage() {
  const [dispatchDate, setDispatchDate] = useState(defaultRouteDate())
  const [deliverySlots, setDeliverySlots] = useState<DistributorDeliverySlot[]>([])
  const [selectedDeliverySlotId, setSelectedDeliverySlotId] = useState<number | null>(null)
  const [routePlans, setRoutePlans] = useState<RoutePlan[]>([])
  const [pendingOrders, setPendingOrders] = useState<PendingRouteOrder[]>([])
  const [selectedOrderIds, setSelectedOrderIds] = useState<number[]>([])
  const [vehicles, setVehicles] = useState<Vehicle[]>([])
  const [drivers, setDrivers] = useState<DriverProfile[]>([])
  const [selectedVehicleIds, setSelectedVehicleIds] = useState<number[]>([])
  const [selectedDriverByVehicleId, setSelectedDriverByVehicleId] = useState<Record<string, number>>({})
  const [manualRuns, setManualRuns] = useState<ManualRunsState>({})
  const [loading, setLoading] = useState(true)
  const [fleetLoading, setFleetLoading] = useState(true)
  const [generating, setGenerating] = useState(false)
  const [editingPlanId, setEditingPlanId] = useState<number | null>(null)
  const [draftRuns, setDraftRuns] = useState<RouteRun[]>([])
  const [removedStopIds, setRemovedStopIds] = useState<number[]>([])
  const routeLoadRequestIdRef = useRef(0)
  const user = useAuthStore((state) => state.user)
  const showSuccess = useFeedbackStore((state) => state.success)
  const showError = useFeedbackStore((state) => state.error)
  const confirm = useFeedbackStore((state) => state.confirm)
  const distributorPlanKey = String(user?.distributor_access?.plan_name ?? '').replace(/\s+/g, '').toUpperCase()
  const manualRoutingEnabled = user?.role === 'DISTRIBUTOR' ? (user.distributor_access.manual_routing_enabled ?? user.distributor_access.routing_enabled) !== false : true
  const automaticRoutingEnabled =
    user?.role === 'DISTRIBUTOR'
      ? (user.distributor_access.automatic_routing_enabled ?? distributorPlanKey === 'MAXIGESTION') === true
      : true
  const routingEnabled = manualRoutingEnabled || automaticRoutingEnabled
  const activePlan = useMemo(() => routePlans.find((plan) => plan.status === 'DRAFT') ?? routePlans[0], [routePlans])
  const mapPlan = activePlan && editingPlanId === activePlan.id ? { ...activePlan, runs: draftRuns } : activePlan
  const activeDeliverySlots = useMemo(
    () => deliverySlots.filter((slot) => slot.active).sort((left, right) => left.sort_order - right.sort_order || left.start_time.localeCompare(right.start_time)),
    [deliverySlots],
  )
  const availableDrivers = useMemo(() => drivers.filter((driver) => driver.active && driver.available), [drivers])
  const selectableVehicles = useMemo(() => vehicles.filter(isVehicleSelectable), [vehicles])
  const selectableVehicleIdSet = useMemo(() => new Set(selectableVehicles.map((vehicle) => vehicle.id)), [selectableVehicles])
  const selectedVehicles = useMemo(() => vehicles.filter((vehicle) => selectedVehicleIds.includes(vehicle.id)), [vehicles, selectedVehicleIds])
  const selectedCapacity = useMemo(() => selectedVehicles.reduce(sumVehicleCapacity, { kg: 0, m3: 0 }), [selectedVehicles])
  const pendingOrderById = useMemo(() => new Map(pendingOrders.map((order) => [order.id, order])), [pendingOrders])
  const filteredOrderSummary = useMemo(() => buildRouteFilterSummary(pendingOrders, routePlans), [pendingOrders, routePlans])
  const manualOrderCount = useMemo(() => Object.values(manualRuns).reduce((total, orderIds) => total + orderIds.length, 0), [manualRuns])
  const manualCapacityWarning = useMemo(
    () => selectedVehicles.some((vehicle) => manualRunMetrics(vehicle, manualRuns[String(vehicle.id)] ?? [], pendingOrderById).overCapacity),
    [manualRuns, pendingOrderById, selectedVehicles],
  )
  const canGenerate = automaticRoutingEnabled && Boolean(selectedDeliverySlotId) && !loading && !fleetLoading && !generating && selectedVehicleIds.some((id) => selectableVehicleIdSet.has(id))
  const canCreateManual =
    manualRoutingEnabled &&
    Boolean(selectedDeliverySlotId) &&
    !loading &&
    !fleetLoading &&
    !generating &&
    manualOrderCount > 0 &&
    !manualCapacityWarning &&
    selectedVehicleIds.some((id) => selectableVehicleIdSet.has(id))

  function resetRouteWorkspace() {
    setRoutePlans([])
    setPendingOrders([])
    setSelectedOrderIds([])
    setManualRuns({})
    setEditingPlanId(null)
    setDraftRuns([])
    setRemovedStopIds([])
  }

  async function load(date = dispatchDate, deliverySlotId = selectedDeliverySlotId) {
    const requestId = routeLoadRequestIdRef.current + 1
    routeLoadRequestIdRef.current = requestId
    resetRouteWorkspace()
    if (!deliverySlotId) {
      setLoading(false)
      return
    }
    setLoading(true)
    try {
      const [plans, pending] = await Promise.all([api.routePlans(date, deliverySlotId), api.pendingRouteOrders(date, deliverySlotId)])
      if (requestId !== routeLoadRequestIdRef.current) return
      setRoutePlans(plans)
      setPendingOrders(pending)
      setSelectedOrderIds(automaticRoutingEnabled ? pending.filter((order) => order.routable).map((order) => order.id) : [])
    } catch (caught) {
      if (requestId === routeLoadRequestIdRef.current) showError(caught instanceof Error ? caught.message : 'No se pudieron cargar las rutas.')
    } finally {
      if (requestId === routeLoadRequestIdRef.current) setLoading(false)
    }
  }

  useEffect(() => {
    if (routingEnabled) void load(dispatchDate, selectedDeliverySlotId)
  }, [automaticRoutingEnabled, dispatchDate, routingEnabled, selectedDeliverySlotId])

  useEffect(() => {
    if (!routingEnabled) return
    let disposed = false
    async function loadFleet() {
      setFleetLoading(true)
      try {
        const [loadedVehicles, loadedDrivers, loadedDeliverySlots] = await Promise.all([api.vehicles(), api.drivers(), api.deliverySlots()])
        if (disposed) return
        setVehicles(loadedVehicles)
        setDrivers(loadedDrivers)
        setDeliverySlots(loadedDeliverySlots)
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

  useEffect(() => {
    setManualRuns((current) => {
      const selected = new Set(selectedVehicleIds.map(String))
      const next = Object.fromEntries(
        Object.entries(current)
          .filter(([vehicleId]) => selected.has(vehicleId))
          .map(([vehicleId, orderIds]) => [vehicleId, orderIds.filter((orderId) => pendingOrderById.has(orderId))]),
      ) as ManualRunsState
      selectedVehicleIds.forEach((vehicleId) => {
        next[String(vehicleId)] = next[String(vehicleId)] ?? []
      })
      return next
    })
  }, [pendingOrderById, selectedVehicleIds])

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
      setManualRuns((current) => {
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
        return recalculateRun({ ...run, stops: resequenceStops(stops) })
      }),
    )
  }

  function moveStopToRun(stopId: number, fromRunId: number, toRunId: number, insertIndex?: number) {
    setDraftRuns((current) => {
      const source = current.find((run) => run.id === fromRunId)
      const destination = current.find((run) => run.id === toRunId)
      const stop = source?.stops.find((item) => item.id === stopId)
      if (!source || !destination || !stop) return current
      if (fromRunId === toRunId) {
        const nextStops = source.stops.filter((item) => item.id !== stopId)
        nextStops.splice(resolveInsertIndex(insertIndex, nextStops.length), 0, stop)
        return current.map((run) => (run.id === fromRunId ? recalculateRun({ ...run, stops: resequenceStops(nextStops) }) : run))
      }
      return current.map((run) => {
        if (run.id === fromRunId) {
          const stops = resequenceStops(source.stops.filter((item) => item.id !== stopId))
          return recalculateRun({ ...run, stops })
        }
        if (run.id === toRunId) {
          const stops = [...destination.stops]
          stops.splice(resolveInsertIndex(insertIndex, stops.length), 0, stop)
          return recalculateRun({ ...run, stops: resequenceStops(stops) })
        }
        return run
      })
    })
  }

  function removeStop(stopId: number, runId: number) {
    if (stopId > 0) setRemovedStopIds((current) => (current.includes(stopId) ? current : [...current, stopId]))
    setDraftRuns((current) =>
      current.map((run) => {
        if (run.id !== runId) return run
        const stops = resequenceStops(run.stops.filter((stop) => stop.id !== stopId))
        return recalculateRun({ ...run, stops })
      }),
    )
  }

  function addPendingOrderToDraftRun(orderId: number, toRunId: number, insertIndex?: number) {
    const order = pendingOrderById.get(orderId)
    if (!order?.routable) return
    setDraftRuns((current) => {
      if (current.some((run) => run.stops.some((stop) => stop.order === orderId))) return current
      return current.map((run) => {
        if (run.id !== toRunId) return run
        const stops = [...run.stops]
        stops.splice(resolveInsertIndex(insertIndex, stops.length), 0, pendingOrderToStop(order))
        return recalculateRun({ ...run, stops: resequenceStops(stops) })
      })
    })
  }

  function handleDraftStopDrop(event: DragEvent, toRunId: number, insertIndex?: number) {
    const payload = readDragPayload(event)
    if (!payload) return
    event.preventDefault()
    if (payload.source === 'draft-stop') moveStopToRun(payload.stopId, payload.fromRunId, toRunId, insertIndex)
    if (payload.source === 'pending-order') addPendingOrderToDraftRun(payload.orderId, toRunId, insertIndex)
  }

  function assignManualOrder(orderId: number, vehicleId: number, insertIndex?: number) {
    const order = pendingOrderById.get(orderId)
    if (!order?.routable || !selectedVehicleIds.includes(vehicleId)) return
    setManualRuns((current) => {
      const next = Object.fromEntries(Object.entries(current).map(([currentVehicleId, orderIds]) => [currentVehicleId, orderIds.filter((id) => id !== orderId)])) as ManualRunsState
      const key = String(vehicleId)
      const target = [...(next[key] ?? [])]
      target.splice(resolveInsertIndex(insertIndex, target.length), 0, orderId)
      next[key] = target
      return next
    })
  }

  function moveManualOrder(orderId: number, fromVehicleId: number, toVehicleId: number, insertIndex?: number) {
    if (!selectedVehicleIds.includes(toVehicleId)) return
    setManualRuns((current) => {
      const next = Object.fromEntries(Object.entries(current).map(([vehicleId, orderIds]) => [vehicleId, orderIds.filter((id) => id !== orderId)])) as ManualRunsState
      const key = String(toVehicleId)
      const target = [...(next[key] ?? [])]
      target.splice(resolveInsertIndex(insertIndex, target.length), 0, orderId)
      next[key] = target
      next[String(fromVehicleId)] = next[String(fromVehicleId)] ?? []
      return next
    })
  }

  function reorderManualOrder(vehicleId: number, orderId: number, direction: -1 | 1) {
    setManualRuns((current) => {
      const key = String(vehicleId)
      const orders = [...(current[key] ?? [])]
      const index = orders.indexOf(orderId)
      const nextIndex = index + direction
      if (index < 0 || nextIndex < 0 || nextIndex >= orders.length) return current
      ;[orders[index], orders[nextIndex]] = [orders[nextIndex], orders[index]]
      return { ...current, [key]: orders }
    })
  }

  function removeManualOrder(orderId: number, vehicleId: number) {
    setManualRuns((current) => {
      const key = String(vehicleId)
      return { ...current, [key]: (current[key] ?? []).filter((id) => id !== orderId) }
    })
  }

  function clearManualRun(vehicleId: number) {
    setManualRuns((current) => ({ ...current, [String(vehicleId)]: [] }))
  }

  function handlePendingDrop(event: DragEvent) {
    const payload = readDragPayload(event)
    if (!payload) return
    event.preventDefault()
    if (payload.source === 'manual-order') removeManualOrder(payload.orderId, payload.fromVehicleId)
    if (payload.source === 'draft-stop') removeStop(payload.stopId, payload.fromRunId)
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
    if (!selectedDeliverySlotId) {
      showError('Selecciona una franja horaria antes de generar rutas.')
      return
    }
    const deliverySlotId = selectedDeliverySlotId
    const vehicleIds = selectedVehicleIds.filter((id) => selectableVehicleIdSet.has(id))
    if (vehicleIds.length === 0) {
      showError('Selecciona al menos un vehiculo activo con capacidad cargada.')
      return
    }
    setGenerating(true)
    try {
      const payload: Record<string, unknown> = { dispatch_date: dispatchDate, delivery_slot_id: deliverySlotId }
      if (selectedOrderIds.length > 0) payload.order_ids = selectedOrderIds
      payload.vehicle_ids = vehicleIds
      const vehicleDriverIds = Object.fromEntries(Object.entries(selectedDriverByVehicleId).filter(([vehicleId]) => vehicleIds.includes(Number(vehicleId))))
      if (Object.keys(vehicleDriverIds).length > 0) payload.vehicle_driver_ids = vehicleDriverIds
      await api.generateRoutePlan(payload, `route-preview-${dispatchDate}-${deliverySlotId}-${Date.now()}`)
      setSelectedVehicleIds([])
      setSelectedDriverByVehicleId({})
      showSuccess('Rutas generadas.')
      await load(dispatchDate, deliverySlotId)
    } catch (caught) {
      showError(caught instanceof Error ? caught.message : 'No se pudo generar el borrador.')
    } finally {
      setGenerating(false)
    }
  }

  async function createManualRoute() {
    if (!selectedDeliverySlotId) {
      showError('Selecciona una franja horaria antes de crear la ruta manual.')
      return
    }
    const deliverySlotId = selectedDeliverySlotId
    const vehicleIds = selectedVehicleIds.filter((id) => selectableVehicleIdSet.has(id))
    const runs = vehicleIds.map((vehicleId) => ({
      vehicle_id: vehicleId,
      driver_id: selectedDriverByVehicleId[String(vehicleId)] ?? null,
      order_ids: manualRuns[String(vehicleId)] ?? [],
    }))
    const assignedOrderIds = new Set(runs.flatMap((run) => run.order_ids))
    if (assignedOrderIds.size === 0) {
      showError('Arrastra al menos un pedido a un vehiculo para crear la ruta manual.')
      return
    }
    if (manualCapacityWarning) {
      showError('Hay recorridos que superan la capacidad cargada del vehiculo.')
      return
    }
    setGenerating(true)
    try {
      await api.createManualRoutePlan({ dispatch_date: dispatchDate, delivery_slot_id: deliverySlotId, runs })
      setSelectedVehicleIds([])
      setSelectedDriverByVehicleId({})
      showSuccess('Ruta manual creada.')
      await load(dispatchDate, deliverySlotId)
    } catch (caught) {
      showError(caught instanceof Error ? caught.message : 'No se pudo crear la ruta manual.')
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
      if (action === 'confirm') await api.confirmRoutePlan(planId, { reviewed: true })
      else if (action === 'dispatch') await api.dispatchRoutePlan(planId)
      else await api.replanRoutePlan(planId)
      showSuccess(action === 'confirm' ? 'Borrador confirmado. Ya podes imprimir la hoja de preparacion.' : action === 'dispatch' ? 'Ruta despachada.' : 'Se genero una nueva propuesta.')
      await load(dispatchDate, selectedDeliverySlotId)
    } catch (caught) {
      showError(caught instanceof Error ? caught.message : 'No se pudo completar la accion.')
    }
  }

  function printPreparation(plan: RoutePlan) {
    if (!openPreparationSheet(plan)) {
      showError('No se pudo abrir la hoja de preparacion. Revisa si el navegador bloqueo la ventana emergente.')
    }
  }

  async function saveEdit(planId: number) {
    try {
      await api.patchRouteStops(planId, {
        stops: draftRuns.flatMap((run) =>
          run.stops.map((stop) => ({
            ...(stop.id > 0 ? { id: stop.id } : { order_id: stop.order }),
            route_run_id: run.id,
            sequence: stop.sequence,
            lat: stop.lat ?? stop.delivery_latitude ?? undefined,
            lng: stop.lng ?? stop.delivery_longitude ?? undefined,
          })),
        ),
        remove_stop_ids: removedStopIds,
      })
      showSuccess('Ruta editada y recalculada.')
      await load(dispatchDate, selectedDeliverySlotId)
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
      showSuccess('Ruta eliminada.')
      await load(dispatchDate, selectedDeliverySlotId)
    } catch (caught) {
      showError(caught instanceof Error ? caught.message : 'No se pudo eliminar la ruta.')
    }
  }

  if (!routingEnabled) {
    return (
      <section className="grid gap-4">
        <div>
          <h1 className="text-2xl font-800 text-slate-950">Ruteo</h1>
        </div>
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-5 text-sm font-700 text-amber-900">
          Ruteo no habilitado.
        </div>
      </section>
    )
  }

  return (
    <section className="grid gap-5">
      <div className="grid gap-4 border-b border-slate-200 pb-5 lg:grid-cols-[1fr_auto] lg:items-end">
        <div className="max-w-3xl">
          <h1 className="text-2xl font-800 text-slate-950">Ruteo de entregas</h1>
        </div>
        <div className="flex flex-wrap items-end gap-3">
          <label className="grid gap-1 text-sm font-700 text-slate-700">
            Fecha de entrega
            <input className="min-h-11 rounded-md border border-slate-300 px-3" type="date" value={dispatchDate} onChange={(event) => setDispatchDate(event.target.value)} />
          </label>
          <label className="grid min-w-56 gap-1 text-sm font-700 text-slate-700">
            Franja horaria
            <select
              className="min-h-11 rounded-md border border-slate-300 bg-white px-3"
              value={selectedDeliverySlotId ?? ''}
              onChange={(event) => {
                setSelectedDeliverySlotId(event.target.value ? Number(event.target.value) : null)
                setEditingPlanId(null)
                setDraftRuns([])
                setRemovedStopIds([])
              }}
            >
              <option value="">Seleccionar franja</option>
              {activeDeliverySlots.map((slot) => (
                <option key={slot.id} value={slot.id}>
                  {deliverySlotLabel(slot)}
                </option>
              ))}
            </select>
          </label>
          <div className="rounded-md border border-slate-200 bg-white px-3 py-2 text-xs font-800 text-slate-600">
            Capacidad seleccionada: {formatCapacityAmount(selectedCapacity.kg, 'kg')} - {formatCapacityAmount(selectedCapacity.m3, 'm3')}
          </div>
          <RouteFilterTotals summary={filteredOrderSummary} />
          {manualRoutingEnabled ? (
            <button className="min-h-11 rounded-md bg-slate-950 px-4 font-800 text-white disabled:opacity-60" type="button" disabled={!canCreateManual} onClick={() => void createManualRoute()}>
              {generating ? 'Creando...' : 'Crear ruta manual'}
            </button>
          ) : null}
          {automaticRoutingEnabled ? (
            <button className="min-h-11 rounded-md bg-brand-600 px-4 font-800 text-white disabled:opacity-60" type="button" disabled={!canGenerate} onClick={() => void generate()}>
              {fleetLoading ? 'Cargando flota...' : generating ? 'Generando...' : 'Generar rutas'}
            </button>
          ) : null}
        </div>
      </div>

      {activeDeliverySlots.length === 0 ? (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-5 text-sm font-700 text-amber-900">
          Sin franjas activas.
        </div>
      ) : !selectedDeliverySlotId ? (
        null
      ) : loading ? (
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
                  setManualRuns({})
                }}
                onSelectAll={() => setSelectedVehicleIds(selectableVehicles.map((vehicle) => vehicle.id))}
                onSelectDriver={selectVehicleDriver}
                onToggle={toggleVehicle}
              />
              {activePlan ? <RouteSummary plan={activePlan} /> : null}
            </div>
          </section>

          <ManualRouteBoard
            automaticRoutingEnabled={automaticRoutingEnabled}
            canCreateManual={canCreateManual}
            fleetLoading={fleetLoading}
            generating={generating}
            manualRuns={manualRuns}
            orders={pendingOrders}
            pendingOrderById={pendingOrderById}
            selectedDriverByVehicleId={selectedDriverByVehicleId}
            selectedOrderIds={selectedOrderIds}
            selectedVehicleIds={selectedVehicleIds}
            vehicles={vehicles}
            onAssignOrder={assignManualOrder}
            onClearRun={clearManualRun}
            onCreateManual={() => void createManualRoute()}
            onDropPending={handlePendingDrop}
            onMoveOrder={moveManualOrder}
            onRemoveOrder={removeManualOrder}
            onReorderOrder={reorderManualOrder}
            onSelectAllAuto={() => setSelectedOrderIds(pendingOrders.filter((order) => order.routable).map((order) => order.id))}
            onToggleAutoOrder={toggleOrder}
          />

          {routePlans.length === 0 ? <EmptyState title="Sin rutas" /> : null}

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
                    <p className="mt-1 text-xs font-800 text-slate-500">
                      {plan.dispatch_date} - {routeSlotSummary(plan)}
                    </p>
                  </div>
                  <StatusBadge status={plan.status} />
                </div>

                {editable && (
                  <p className="rounded-md border border-brand-200 bg-brand-50 px-3 py-2 text-sm font-700 text-brand-700">
                    Modo edicion.
                  </p>
                )}

                <div className="grid gap-4 lg:grid-cols-2">
                  {runs.map((run) => {
                    const vehicle = vehicles.find((item) => item.id === run.vehicle)
                    const capacity = vehicle ? routeRunMetrics(run, vehicle) : null
                    return (
                    <section
                      key={run.id}
                      className="rounded-lg border border-slate-200 bg-slate-50 p-4"
                      onDragOver={(event) => {
                        if (editable) event.preventDefault()
                      }}
                      onDrop={(event) => {
                        if (editable) handleDraftStopDrop(event, run.id)
                      }}
                    >
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                          <h3 className="font-800 text-slate-950">{run.driver_name}</h3>
                          <p className="text-sm text-slate-600">
                            {run.vehicle_plate} - {Number(run.load_kg).toLocaleString('es-AR')} kg - {Number(run.load_m3).toLocaleString('es-AR')} m3
                          </p>
                        </div>
                        <span className="rounded-md bg-white px-3 py-1 text-xs font-800 text-slate-600">{run.total_stops} paradas</span>
                      </div>
                      {capacity ? <CapacityMeter className="mt-3" metrics={capacity} /> : null}
                      <div className="mt-4 grid gap-3">
                        {run.stops.map((stop, stopIndex) => (
                          <div
                            key={stop.id}
                            className={`rounded-md border bg-white p-3 text-sm ${editable ? 'cursor-grab border-slate-300 active:cursor-grabbing' : 'border-slate-200'}`}
                            draggable={editable}
                            onDragStart={(event) => {
                              if (editable) writeDragPayload(event, { source: 'draft-stop', stopId: stop.id, fromRunId: run.id })
                            }}
                            onDragOver={(event) => {
                              if (editable) event.preventDefault()
                            }}
                            onDrop={(event) => {
                              if (editable) handleDraftStopDrop(event, run.id, stopIndex)
                            }}
                          >
                            <div className="flex items-center justify-between gap-3">
                              <strong className="text-slate-950">
                                #{stop.sequence} - {stop.commerce_name}
                              </strong>
                              <StatusBadge status={stop.status} />
                            </div>
                            <p className="mt-1 text-slate-600">{stop.delivery_address}</p>
                            <p className="mt-1 text-slate-500">
                              ETA {timeLabel(stop.planned_eta)} - ventana {timeLabel(stop.window_start_at)} - {timeLabel(stop.window_end_at)}
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
                    )
                  })}
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
                  {!editable && canPrintPreparationSheet(plan) ? (
                    <button className="min-h-11 rounded-md border border-slate-300 px-4 font-800 text-slate-700" type="button" onClick={() => printPreparation(plan)}>
                      Imprimir preparacion
                    </button>
                  ) : null}
                  {automaticRoutingEnabled && !editable && plan.status !== 'DISPATCHED' && plan.status !== 'COMPLETED' ? (
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

function ManualRouteBoard({
  orders,
  vehicles,
  selectedVehicleIds,
  selectedDriverByVehicleId,
  selectedOrderIds,
  manualRuns,
  pendingOrderById,
  automaticRoutingEnabled,
  canCreateManual,
  generating,
  fleetLoading,
  onAssignOrder,
  onMoveOrder,
  onReorderOrder,
  onRemoveOrder,
  onClearRun,
  onCreateManual,
  onToggleAutoOrder,
  onSelectAllAuto,
  onDropPending,
}: {
  orders: PendingRouteOrder[]
  vehicles: Vehicle[]
  selectedVehicleIds: number[]
  selectedDriverByVehicleId: Record<string, number>
  selectedOrderIds: number[]
  manualRuns: ManualRunsState
  pendingOrderById: Map<number, PendingRouteOrder>
  automaticRoutingEnabled: boolean
  canCreateManual: boolean
  generating: boolean
  fleetLoading: boolean
  onAssignOrder: (orderId: number, vehicleId: number, insertIndex?: number) => void
  onMoveOrder: (orderId: number, fromVehicleId: number, toVehicleId: number, insertIndex?: number) => void
  onReorderOrder: (vehicleId: number, orderId: number, direction: -1 | 1) => void
  onRemoveOrder: (orderId: number, vehicleId: number) => void
  onClearRun: (vehicleId: number) => void
  onCreateManual: () => void
  onToggleAutoOrder: (order: PendingRouteOrder, checked: boolean) => void
  onSelectAllAuto: () => void
  onDropPending: (event: DragEvent) => void
}) {
  const selectedVehicles = vehicles.filter((vehicle) => selectedVehicleIds.includes(vehicle.id))
  const assignedOrderIds = new Set(Object.values(manualRuns).flat())
  const pendingManualOrders = orders.filter((order) => !assignedOrderIds.has(order.id))
  const selectedVehicleOptions = selectedVehicles.map((vehicle) => ({ id: vehicle.id, label: vehicle.plate || `Vehiculo #${vehicle.id}` }))

  function handleRunDrop(event: DragEvent, vehicleId: number, insertIndex?: number) {
    const payload = readDragPayload(event)
    if (!payload) return
    event.preventDefault()
    if (payload.source === 'pending-order') onAssignOrder(payload.orderId, vehicleId, insertIndex)
    if (payload.source === 'manual-order') onMoveOrder(payload.orderId, payload.fromVehicleId, vehicleId, insertIndex)
  }

  return (
    <section className="grid gap-3 rounded-lg border border-slate-200 bg-white p-4 shadow-soft">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="font-800 text-slate-950">Tablero de ruteo manual</h2>
          <p className="mt-1 text-sm text-slate-600">
            {pendingManualOrders.length} pendientes - {assignedOrderIds.size} en ruta manual - {selectedVehicles.length} vehiculos activos
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {automaticRoutingEnabled ? (
            <button className="min-h-9 rounded-md border border-slate-300 px-3 text-xs font-800 text-slate-700" type="button" onClick={onSelectAllAuto}>
              Auto: todos
            </button>
          ) : null}
          <button className="min-h-9 rounded-md bg-slate-950 px-3 text-xs font-800 text-white disabled:opacity-60" type="button" disabled={!canCreateManual} onClick={onCreateManual}>
            {generating ? 'Creando...' : 'Crear manual'}
          </button>
        </div>
      </div>

      <div className="grid gap-3 xl:grid-cols-[18rem_minmax(0,1fr)]">
        <div
          className="grid content-start gap-2 rounded-md border border-slate-200 bg-slate-50 p-3"
          onDragOver={(event) => event.preventDefault()}
          onDrop={onDropPending}
        >
          <div className="flex items-center justify-between gap-2">
            <h3 className="text-sm font-800 text-slate-950">Pedidos pendientes</h3>
            <span className="rounded-md bg-white px-2 py-1 text-[11px] font-800 text-slate-500">{pendingManualOrders.length}</span>
          </div>
          <div className="grid max-h-[30rem] gap-2 overflow-y-auto pr-1">
            {orders.length === 0 ? (
              <p className="rounded-md border border-dashed border-slate-300 bg-white px-3 py-4 text-sm font-700 text-slate-500">Sin pedidos pendientes fuera de borradores activos.</p>
            ) : pendingManualOrders.length === 0 ? (
              <p className="rounded-md border border-dashed border-slate-300 bg-white px-3 py-4 text-sm font-700 text-slate-500">Todos los pedidos disponibles estan asignados al tablero.</p>
            ) : (
              pendingManualOrders.map((order) => (
                <div
                  key={order.id}
                  className={`rounded-md border p-3 text-sm ${order.routable ? 'cursor-grab border-slate-200 bg-white active:cursor-grabbing' : 'border-amber-200 bg-amber-50'}`}
                  draggable={order.routable}
                  onDragStart={(event) => writeDragPayload(event, { source: 'pending-order', orderId: order.id })}
                >
                  <div className="flex items-start justify-between gap-2">
                    <strong className="text-slate-950">{order.commerce_name}</strong>
                    {automaticRoutingEnabled ? (
                      <label className="flex items-center gap-1 text-[11px] font-800 text-slate-500">
                        <input
                          className="h-4 w-4"
                          type="checkbox"
                          disabled={!order.routable}
                          checked={selectedOrderIds.includes(order.id)}
                          onChange={(event) => onToggleAutoOrder(order, event.target.checked)}
                        />
                        Auto
                      </label>
                    ) : null}
                  </div>
                  <p className="mt-1 line-clamp-2 text-slate-600">{order.delivery_address}</p>
                  <p className="mt-1 text-xs font-700 text-slate-500">
                    {formatCapacityAmount(Number(order.planned_weight_kg), 'kg')} - {formatCapacityAmount(Number(order.planned_volume_m3), 'm3')}
                    {order.exclusion_reason ? ` - ${reasonLabel(order.exclusion_reason)}` : ''}
                  </p>
                  <select
                    className="mt-2 min-h-9 w-full rounded-md border border-slate-300 bg-white px-2 text-xs font-800 text-slate-700 disabled:opacity-60"
                    defaultValue=""
                    disabled={!order.routable || selectedVehicleOptions.length === 0}
                    aria-label={`Agregar pedido ${order.id} a una ruta`}
                    onChange={(event) => {
                      if (!event.target.value) return
                      onAssignOrder(order.id, Number(event.target.value))
                      event.target.value = ''
                    }}
                  >
                    <option value="">Agregar a...</option>
                    {selectedVehicleOptions.map((vehicle) => (
                      <option key={vehicle.id} value={vehicle.id}>
                        {vehicle.label}
                      </option>
                    ))}
                  </select>
                </div>
              ))
            )}
          </div>
        </div>

        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {fleetLoading ? (
            <p className="rounded-md border border-dashed border-slate-300 px-3 py-4 text-sm font-700 text-slate-500">Cargando flota...</p>
          ) : selectedVehicles.length === 0 ? (
            <p className="rounded-md border border-dashed border-slate-300 px-3 py-4 text-sm font-700 text-slate-500">Selecciona vehiculos para abrir columnas de ruta manual.</p>
          ) : (
            selectedVehicles.map((vehicle) => {
              const orderIds = manualRuns[String(vehicle.id)] ?? []
              const runOrders = orderIds.map((orderId) => pendingOrderById.get(orderId)).filter(Boolean) as PendingRouteOrder[]
              const metrics = manualRunMetrics(vehicle, orderIds, pendingOrderById)
              return (
                <section
                  key={vehicle.id}
                  className={`grid content-start gap-3 rounded-md border p-3 ${metrics.overCapacity ? 'border-red-300 bg-red-50' : 'border-slate-200 bg-slate-50'}`}
                  onDragOver={(event) => event.preventDefault()}
                  onDrop={(event) => handleRunDrop(event, vehicle.id)}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <h3 className="font-800 text-slate-950">{vehicle.plate}</h3>
                      <p className="text-xs font-700 text-slate-500">
                        {selectedDriverByVehicleId[String(vehicle.id)] ? `Chofer #${selectedDriverByVehicleId[String(vehicle.id)]}` : 'Chofer sin asignar'}
                      </p>
                    </div>
                    <button className="min-h-8 rounded-md border border-slate-300 bg-white px-2 text-[11px] font-800 text-slate-600" type="button" onClick={() => onClearRun(vehicle.id)}>
                      Vaciar
                    </button>
                  </div>
                  <CapacityMeter metrics={metrics} />
                  <div className="grid min-h-28 gap-2">
                    {runOrders.length === 0 ? (
                      <div className="rounded-md border border-dashed border-slate-300 bg-white px-3 py-4 text-sm font-700 text-slate-500">Arrastra pedidos aca.</div>
                    ) : (
                      runOrders.map((order, orderIndex) => (
                        <div
                          key={order.id}
                          className="cursor-grab rounded-md border border-slate-200 bg-white p-3 text-sm active:cursor-grabbing"
                          draggable
                          onDragStart={(event) => writeDragPayload(event, { source: 'manual-order', orderId: order.id, fromVehicleId: vehicle.id })}
                          onDragOver={(event) => event.preventDefault()}
                          onDrop={(event) => handleRunDrop(event, vehicle.id, orderIndex)}
                        >
                          <div className="flex items-start justify-between gap-2">
                            <strong className="text-slate-950">
                              #{orderIndex + 1} {order.commerce_name}
                            </strong>
                            <button className="rounded-md border border-red-200 px-2 py-1 text-[11px] font-800 text-red-700" type="button" onClick={() => onRemoveOrder(order.id, vehicle.id)}>
                              Quitar
                            </button>
                          </div>
                          <p className="mt-1 line-clamp-2 text-slate-600">{order.delivery_address}</p>
                          <p className="mt-1 text-xs font-700 text-slate-500">
                            {formatCapacityAmount(Number(order.planned_weight_kg), 'kg')} - {formatCapacityAmount(Number(order.planned_volume_m3), 'm3')}
                          </p>
                          <div className="mt-2 flex flex-wrap gap-2">
                            <button className="min-h-8 rounded-md border border-slate-300 px-2 text-[11px] font-800 text-slate-700" type="button" onClick={() => onReorderOrder(vehicle.id, order.id, -1)}>
                              Subir
                            </button>
                            <button className="min-h-8 rounded-md border border-slate-300 px-2 text-[11px] font-800 text-slate-700" type="button" onClick={() => onReorderOrder(vehicle.id, order.id, 1)}>
                              Bajar
                            </button>
                            <select
                              className="min-h-8 rounded-md border border-slate-300 px-2 text-[11px] font-800 text-slate-700"
                              defaultValue=""
                              aria-label={`Mover pedido ${order.id}`}
                              onChange={(event) => {
                                if (!event.target.value) return
                                onMoveOrder(order.id, vehicle.id, Number(event.target.value))
                                event.target.value = ''
                              }}
                            >
                              <option value="">Mover</option>
                              {selectedVehicleOptions
                                .filter((candidate) => candidate.id !== vehicle.id)
                                .map((candidate) => (
                                  <option key={candidate.id} value={candidate.id}>
                                    {candidate.label}
                                  </option>
                                ))}
                            </select>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </section>
              )
            })
          )}
        </div>
      </div>
    </section>
  )
}

function RouteFilterTotals({ summary }: { summary: RouteFilterSummary }) {
  return (
    <div className="rounded-md border border-brand-200 bg-brand-50 px-3 py-2 text-xs font-800 text-brand-800" aria-label="Resumen de pedidos filtrados">
      <p>Pedidos filtrados: {summary.orders}</p>
      <p className="mt-0.5">
        Carga filtrada: {formatCapacityAmount(summary.kg, 'kg')} - {formatCapacityAmount(summary.m3, 'm3')}
      </p>
    </div>
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
          <p className="mt-1 text-xs font-800 text-slate-500">
            {plan.dispatch_date} - {routeSlotSummary(plan)}
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

function buildRouteFilterSummary(pendingOrders: PendingRouteOrder[], routePlans: RoutePlan[]): RouteFilterSummary {
  const loadsByOrderId = new Map<number, { kg: number; m3: number }>()
  pendingOrders.forEach((order) => {
    loadsByOrderId.set(order.id, {
      kg: capacityNumber(order.planned_weight_kg),
      m3: capacityNumber(order.planned_volume_m3),
    })
  })
  routePlans.forEach((plan) => {
    plan.runs.forEach((run) => {
      run.stops.forEach((stop) => {
        if (loadsByOrderId.has(stop.order)) return
        loadsByOrderId.set(stop.order, {
          kg: capacityNumber(stop.demand_kg),
          m3: capacityNumber(stop.demand_m3),
        })
      })
    })
  })
  return Array.from(loadsByOrderId.values()).reduce<RouteFilterSummary>(
    (summary, load) => ({
      orders: summary.orders + 1,
      kg: summary.kg + load.kg,
      m3: summary.m3 + load.m3,
    }),
    { orders: 0, kg: 0, m3: 0 },
  )
}

function capacityNumber(value: string | number | null | undefined) {
  const amount = Number(value ?? 0)
  return Number.isFinite(amount) ? amount : 0
}

function formatCapacityAmount(value: number, unit: 'kg' | 'm3') {
  if (!Number.isFinite(value) || value <= 0) return `sin ${unit}`
  return `${value.toLocaleString('es-AR', { maximumFractionDigits: unit === 'kg' ? 0 : 2 })} ${unit}`
}

function canPrintPreparationSheet(plan: RoutePlan) {
  return ['CONFIRMED', 'DISPATCHED', 'COMPLETED'].includes(plan.status)
}

function openPreparationSheet(plan: RoutePlan) {
  const printWindow = window.open('', '_blank', 'width=1024,height=768')
  if (!printWindow) return false
  printWindow.document.open()
  printWindow.document.write(buildPreparationSheetHtml(plan))
  printWindow.document.close()
  printWindow.focus()
  printWindow.print()
  return true
}

function buildPreparationSheetHtml(plan: RoutePlan) {
  const routeNumber = plan.route_number || `HR-${String(plan.id).padStart(6, '0')}`
  const totalLines = plan.runs.reduce((total, run) => total + run.stops.reduce((stopTotal, stop) => stopTotal + (stop.lines?.length ?? 0), 0), 0)
  return `<!doctype html>
<html lang="es">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${escapeHtml(routeNumber)} - Hoja de preparacion</title>
  <style>
    @page { size: A4; margin: 12mm; }
    * { box-sizing: border-box; }
    body { margin: 0; background: #f8fafc; color: #0f172a; font-family: Arial, Helvetica, sans-serif; font-size: 12px; line-height: 1.35; }
    main { max-width: 980px; margin: 0 auto; background: #fff; padding: 24px; }
    header { display: grid; gap: 14px; border-bottom: 2px solid #0f172a; padding-bottom: 16px; }
    h1, h2, h3, p { margin: 0; }
    h1 { font-size: 25px; line-height: 1.1; }
    h2 { font-size: 16px; }
    h3 { font-size: 14px; }
    .muted { color: #475569; }
    .meta { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 8px; }
    .meta div { border: 1px solid #cbd5e1; border-radius: 6px; padding: 8px; }
    .meta strong { display: block; color: #64748b; font-size: 10px; letter-spacing: .04em; text-transform: uppercase; }
    .run { break-inside: avoid; margin-top: 18px; border: 1px solid #cbd5e1; border-radius: 8px; overflow: hidden; }
    .run-head { display: flex; justify-content: space-between; gap: 12px; background: #0f172a; color: #fff; padding: 10px 12px; }
    .run-body { display: grid; gap: 12px; padding: 12px; }
    .order { break-inside: avoid; border: 1px solid #e2e8f0; border-radius: 7px; overflow: hidden; }
    .order-head { display: grid; gap: 4px; background: #f8fafc; border-bottom: 1px solid #e2e8f0; padding: 10px; }
    table { width: 100%; border-collapse: collapse; }
    th, td { border: 1px solid #e2e8f0; padding: 7px; text-align: left; vertical-align: top; }
    th { background: #f1f5f9; color: #334155; font-size: 10px; letter-spacing: .04em; text-transform: uppercase; }
    .num { text-align: right; white-space: nowrap; }
    .check-cell { width: 46px; text-align: center; }
    .check-box { display: inline-block; width: 18px; height: 18px; border: 2px solid #0f172a; border-radius: 3px; }
    .empty { color: #64748b; font-weight: 700; text-align: center; }
    footer { margin-top: 18px; border-top: 1px solid #cbd5e1; padding-top: 10px; color: #64748b; }
    @media print {
      body { background: #fff; }
      main { padding: 0; max-width: none; }
      .run { break-inside: avoid-page; }
      .order { break-inside: avoid-page; }
    }
  </style>
</head>
<body>
  <main>
    <header>
      <div>
        <p class="muted">Hoja de preparacion</p>
        <h1>${escapeHtml(routeNumber)}</h1>
      </div>
      <div class="meta">
        <div><strong>Distribuidora</strong>${escapeHtml(plan.distributor_name)}</div>
        <div><strong>Entrega</strong>${escapeHtml(formatOrderDate(plan.dispatch_date))}</div>
        <div><strong>Franja</strong>${escapeHtml(routeSlotSummary(plan))}</div>
        <div><strong>Estado</strong>${escapeHtml(plan.status)}</div>
        <div><strong>Recorridos</strong>${plan.total_runs}</div>
        <div><strong>Pedidos</strong>${plan.total_orders}</div>
        <div><strong>Articulos</strong>${totalLines}</div>
        <div><strong>Carga</strong>${escapeHtml(formatCapacityAmount(Number(plan.total_load_kg), 'kg'))} / ${escapeHtml(formatCapacityAmount(Number(plan.total_load_m3), 'm3'))}</div>
      </div>
    </header>
    ${plan.runs.map(preparationRunSection).join('')}
    <footer>Emitida ${escapeHtml(new Date().toLocaleString('es-AR'))}. Verificar cantidades preparadas y cargadas antes del despacho.</footer>
  </main>
</body>
</html>`
}

function preparationRunSection(run: RouteRun) {
  return `<section class="run">
  <div class="run-head">
    <div>
      <h2>Recorrido ${run.sequence}</h2>
      <p>${escapeHtml(run.driver_name)} - ${escapeHtml(run.vehicle_plate || 'Vehiculo sin patente')}</p>
    </div>
    <div>${run.total_stops} paradas</div>
  </div>
  <div class="run-body">
    ${run.stops.map(preparationOrderSection).join('')}
  </div>
</section>`
}

function preparationOrderSection(stop: RouteStop) {
  return `<section class="order">
  <div class="order-head">
    <h3>Parada ${stop.sequence} - Pedido #${stop.order} - ${escapeHtml(stop.commerce_name)}</h3>
    <p class="muted">${escapeHtml(stop.delivery_address)}</p>
    <p class="muted">Ventana ${escapeHtml(timeValueLabel(stop.window_start_at))}-${escapeHtml(timeValueLabel(stop.window_end_at))} - ETA ${escapeHtml(timeLabel(stop.planned_eta))}</p>
  </div>
  <table>
    <thead>
      <tr>
        <th class="check-cell">Prep.</th>
        <th>SKU</th>
        <th>Articulo</th>
        <th class="num">Cant.</th>
        <th>Unidad</th>
        <th class="num">Kg</th>
        <th class="num">M3</th>
        <th class="check-cell">Carga</th>
      </tr>
    </thead>
    <tbody>
      ${preparationLineRows(stop)}
    </tbody>
  </table>
</section>`
}

function preparationLineRows(stop: RouteStop) {
  const lines = stop.lines ?? []
  if (lines.length === 0) {
    return '<tr><td class="empty" colspan="8">Sin articulos registrados para este pedido.</td></tr>'
  }
  return lines
    .map(
      (line) => `<tr>
        <td class="check-cell"><span class="check-box"></span></td>
        <td>${escapeHtml(line.sku || '-')}</td>
        <td>${escapeHtml(line.product_name || `Producto #${line.product}`)}</td>
        <td class="num">${escapeHtml(formatQuantity(line.quantity))}</td>
        <td>${escapeHtml(line.uom || '-')}</td>
        <td class="num">${escapeHtml(formatCapacityAmount(Number(line.weight_kg), 'kg'))}</td>
        <td class="num">${escapeHtml(formatCapacityAmount(Number(line.volume_m3), 'm3'))}</td>
        <td class="check-cell"><span class="check-box"></span></td>
      </tr>`,
    )
    .join('')
}

function escapeHtml(value: string | number | null | undefined) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

function CapacityMeter({ metrics, className = '' }: { metrics: CapacityMetrics; className?: string }) {
  const kgWidth = Math.min(metrics.kgPercent, 100)
  const m3Width = Math.min(metrics.m3Percent, 100)
  return (
    <div className={`grid gap-2 text-xs font-800 ${className}`}>
      <div>
        <div className="flex justify-between gap-2 text-slate-600">
          <span>Kg {formatCapacityAmount(metrics.loadKg, 'kg')}</span>
          <span>{metrics.capacityKg > 0 ? `${metrics.kgPercent.toFixed(0)}%` : 'sin limite'}</span>
        </div>
        <div className="mt-1 h-2 overflow-hidden rounded-full bg-slate-200">
          <div className={`h-full rounded-full ${metrics.kgPercent > 100 ? 'bg-red-500' : 'bg-brand-600'}`} style={{ width: `${kgWidth}%` }} />
        </div>
      </div>
      <div>
        <div className="flex justify-between gap-2 text-slate-600">
          <span>M3 {formatCapacityAmount(metrics.loadM3, 'm3')}</span>
          <span>{metrics.capacityM3 > 0 ? `${metrics.m3Percent.toFixed(0)}%` : 'sin limite'}</span>
        </div>
        <div className="mt-1 h-2 overflow-hidden rounded-full bg-slate-200">
          <div className={`h-full rounded-full ${metrics.m3Percent > 100 ? 'bg-red-500' : 'bg-mint-700'}`} style={{ width: `${m3Width}%` }} />
        </div>
      </div>
      {metrics.overCapacity ? <p className="rounded-md border border-red-200 bg-white px-2 py-1 text-red-700">Supera la capacidad del vehiculo.</p> : null}
    </div>
  )
}

function manualRunMetrics(vehicle: Vehicle, orderIds: number[], pendingOrderById: Map<number, PendingRouteOrder>): CapacityMetrics {
  const load = orderIds.reduce(
    (total, orderId) => {
      const order = pendingOrderById.get(orderId)
      return {
        kg: total.kg + Number(order?.planned_weight_kg ?? 0),
        m3: total.m3 + Number(order?.planned_volume_m3 ?? 0),
      }
    },
    { kg: 0, m3: 0 },
  )
  return capacityMetrics(load.kg, load.m3, vehicle)
}

function routeRunMetrics(run: RouteRun, vehicle: Vehicle): CapacityMetrics {
  return capacityMetrics(Number(run.load_kg ?? 0), Number(run.load_m3 ?? 0), vehicle)
}

function capacityMetrics(loadKg: number, loadM3: number, vehicle: Vehicle): CapacityMetrics {
  const capacityKg = Number(vehicle.capacity_kg ?? 0)
  const capacityM3 = Number(vehicle.capacity_m3 ?? 0)
  const kgPercent = capacityKg > 0 ? (loadKg / capacityKg) * 100 : 0
  const m3Percent = capacityM3 > 0 ? (loadM3 / capacityM3) * 100 : 0
  return {
    loadKg,
    loadM3,
    capacityKg,
    capacityM3,
    kgPercent,
    m3Percent,
    overCapacity: (capacityKg > 0 && loadKg > capacityKg) || (capacityM3 > 0 && loadM3 > capacityM3),
  }
}

function vehicleBlockReason(vehicle: Vehicle) {
  if (!vehicle.active || ['MAINTENANCE', 'INACTIVE'].includes(vehicle.status)) return 'no disponible'
  if (!hasVehicleCapacity(vehicle)) return 'sin capacidad cargada'
  return 'sin chofer habitual'
}

function cloneRuns(runs: RouteRun[]) {
  return runs.map((run) => recalculateRun({
    ...run,
    stops: run.stops.map((stop) => ({ ...stop })),
  }))
}

function resequenceStops<T extends { sequence: number }>(stops: T[]) {
  return stops.map((stop, index) => ({ ...stop, sequence: index + 1 }))
}

function recalculateRun(run: RouteRun): RouteRun {
  const stops = resequenceStops(run.stops)
  const loadKg = stops.reduce((total, stop) => total + Number(stop.demand_kg ?? 0), 0)
  const loadM3 = stops.reduce((total, stop) => total + Number(stop.demand_m3 ?? 0), 0)
  return {
    ...run,
    stops,
    total_stops: stops.length,
    load_kg: loadKg.toFixed(3),
    load_m3: loadM3.toFixed(6),
  }
}

function pendingOrderToStop(order: PendingRouteOrder): RouteStop {
  return {
    id: -order.id,
    order: order.id,
    delivery_id: null,
    order_status: order.status,
    commerce_name: order.commerce_name,
    delivery_address: order.delivery_address,
    delivery_latitude: order.lat,
    delivery_longitude: order.lng,
    lat: order.lat,
    lng: order.lng,
    sequence: 1,
    status: 'PENDING',
    address_snapshot: order.address_snapshot,
    planned_eta: '',
    window_start_at: '',
    window_end_at: '',
    leg_distance_km: '0',
    leg_duration_min: '0',
    demand_kg: order.planned_weight_kg,
    demand_m3: order.planned_volume_m3,
    lines: [],
  }
}

function resolveInsertIndex(index: number | undefined, length: number) {
  if (index === undefined || !Number.isFinite(index)) return length
  return Math.max(0, Math.min(index, length))
}

function writeDragPayload(event: DragEvent, payload: ManualDragPayload) {
  event.dataTransfer.effectAllowed = 'move'
  event.dataTransfer.setData('application/x-distromax-route', JSON.stringify(payload))
}

function readDragPayload(event: DragEvent): ManualDragPayload | null {
  const raw = event.dataTransfer.getData('application/x-distromax-route')
  if (!raw) return null
  try {
    const parsed = JSON.parse(raw) as ManualDragPayload
    if (parsed.source === 'pending-order' && Number.isFinite(parsed.orderId)) return parsed
    if (parsed.source === 'manual-order' && Number.isFinite(parsed.orderId) && Number.isFinite(parsed.fromVehicleId)) return parsed
    if (parsed.source === 'draft-stop' && Number.isFinite(parsed.stopId) && Number.isFinite(parsed.fromRunId)) return parsed
  } catch {
    return null
  }
  return null
}

function statusLabel(status: string) {
  const labels: Record<string, string> = {
    PENDING: 'Pendiente',
    ACCEPTED: 'Aceptado',
    REJECTED: 'Rechazado',
    PREPARING: 'Preparando',
    SCHEDULED: 'Programado',
    ON_THE_WAY: 'En camino',
    DELIVERED: 'Entregado',
    CANCELLED: 'Cancelado',
  }
  return labels[status] ?? status
}

function statusFilterMatches(status: string, filterId: string) {
  const filter = orderStatusFilterOptions.find((option) => option.id === filterId)
  if (!filter || filter.id === 'ALL') return true
  return filter.statuses.includes(status)
}

function isOrderRouteLocked(order: Order) {
  return order.route_locked === true
}

function routeLockMessage(order: Order) {
  return `El pedido esta dentro de la ${order.route_lock_label || 'HR'}. Quitalo de la HR para modificarlo.`
}

function customerCanReceiveOrder(customer: Commerce) {
  return Boolean(customer.latitude && customer.longitude)
}

function productAvailable(product: Product) {
  return Math.max(0, Number(product.stock_available ?? 0))
}

function trimQuantity(value: number) {
  return Number.isInteger(value) ? String(value) : value.toFixed(3).replace(/0+$/, '').replace(/\.$/, '')
}

function slotFilterMatches(order: Order, filterId: string) {
  if (filterId === 'ALL') return true
  if (filterId === 'NONE') return !order.delivery_slot && !order.delivery_slot_name
  return order.delivery_slot === Number(filterId)
}

function countOrdersByStatusFilter(orders: Order[], filterId: string) {
  return orders.filter((order) => statusFilterMatches(order.status, filterId)).length
}

function compareOrdersForWork(left: Order, right: Order) {
  const statusDifference = (orderStatusPriority[left.status] ?? 99) - (orderStatusPriority[right.status] ?? 99)
  if (statusDifference !== 0) return statusDifference
  const leftDate = left.dispatch_date || '9999-12-31'
  const rightDate = right.dispatch_date || '9999-12-31'
  if (leftDate !== rightDate) return leftDate.localeCompare(rightDate)
  return Number(right.id) - Number(left.id)
}

function displayValue(value: string | number | null | undefined) {
  const text = String(value ?? '').trim()
  return text || '-'
}

function formatCustomerAddress(customer: Commerce | null, order: Order) {
  if (!customer) return order.delivery_address
  return [customer.address, customer.city, customer.province].filter(Boolean).join(', ') || order.delivery_address
}

function customerCoordinates(customer: Commerce | null, order: Order) {
  const latitude = customer?.latitude ?? order.delivery_latitude
  const longitude = customer?.longitude ?? order.delivery_longitude
  if (!latitude || !longitude) return ''
  return `${latitude}, ${longitude}`
}

function formatMoney(value: string | number | null | undefined) {
  const amount = Number(value ?? 0)
  return amount.toLocaleString('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 })
}

function formatQuantity(value: string | number | null | undefined) {
  const amount = Number(value ?? 0)
  return amount.toLocaleString('es-AR', { maximumFractionDigits: 2 })
}

function formatOrderDate(value: string | null | undefined) {
  if (!value) return 'Sin fecha'
  const [year, month, day] = value.split('-')
  if (!year || !month || !day) return value
  return `${day}/${month}/${year}`
}

function deliverySlotLabel(slot: DistributorDeliverySlot) {
  return `${slot.name} (${timeValueLabel(slot.start_time)}-${timeValueLabel(slot.end_time)})`
}

function deliverySlotSummary(order: Order) {
  if (order.delivery_slot_name) {
    return `${order.delivery_slot_name} ${windowRangeLabel(order.delivery_window_start, order.delivery_window_end)}`
  }
  return windowRangeLabel(order.delivery_window_start, order.delivery_window_end)
}

function routeSlotSummary(plan: RoutePlan) {
  if (plan.delivery_slot_name) {
    return `${plan.delivery_slot_name} ${windowRangeLabel(plan.delivery_window_start, plan.delivery_window_end)}`
  }
  return windowRangeLabel(plan.delivery_window_start, plan.delivery_window_end)
}

function windowRangeLabel(start: string | null | undefined, end: string | null | undefined) {
  if (!start || !end) return 'Sin franja'
  return `${timeValueLabel(start)}-${timeValueLabel(end)}`
}

function timeValueLabel(value: string | null | undefined) {
  if (!value) return ''
  if (/^\d{2}:\d{2}/.test(value)) return value.slice(0, 5)
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return String(value).slice(0, 5)
  return date.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })
}

function defaultRouteDate() {
  const base = new Date()
  base.setDate(base.getDate() + 1)
  return base.toISOString().slice(0, 10)
}

function addDaysIso(days: number) {
  const base = new Date()
  base.setDate(base.getDate() + days)
  return base.toISOString().slice(0, 10)
}

function timeLabel(value: string) {
  if (!value) return 'pendiente'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return 'pendiente'
  return date.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })
}

function reasonLabel(reason: string) {
  if (reason === 'missing_coords' || reason === 'missing_coordinates') return 'faltan coordenadas'
  if (reason === 'capacity_exceeded') return 'supera la capacidad disponible'
  if (reason === 'window_infeasible') return 'la franja no cierra con ninguna ruta'
  if (reason === 'missing_physical_lines') return 'sin lineas fisicas'
  return reason
}
