import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'

import { AddressEditor } from '../components/AddressEditor'
import { EmptyState } from '../components/EmptyState'
import { Icon } from '../components/Icon'
import { StatusBadge } from '../components/StatusBadge'
import { api } from '../services/api'
import { useAuthStore } from '../stores/authStore'
import { useCartStore } from '../stores/cartStore'
import { useFeedbackStore } from '../stores/feedbackStore'
import { useOrderStore } from '../stores/orderStore'
import type { Commerce, Distributor, Order, Product } from '../types/domain'

const customerOrderFilterOptions = [
  { id: 'ALL', label: 'Todos', statuses: [] },
  { id: 'OPEN', label: 'En curso', statuses: ['PENDING', 'ACCEPTED', 'PREPARING', 'SCHEDULED', 'ON_THE_WAY'] },
  { id: 'PENDING', label: 'Pendientes', statuses: ['PENDING'] },
  { id: 'DELIVERED', label: 'Entregados', statuses: ['DELIVERED'] },
  { id: 'ISSUES', label: 'Con problema', statuses: ['REJECTED', 'CANCELLED'] },
]

const customerOrderStatusPriority: Record<string, number> = {
  ON_THE_WAY: 0,
  SCHEDULED: 1,
  ACCEPTED: 2,
  PREPARING: 3,
  PENDING: 4,
  DELIVERED: 5,
  REJECTED: 6,
  CANCELLED: 7,
}

export function HomePage() {
  return <DistributorsDirectory title="Elegi una distribuidora" />
}

export function DistributorsPage() {
  return <DistributorsDirectory title="Distribuidoras" />
}

function DistributorsDirectory({ title }: { title: string }) {
  const [distributors, setDistributors] = useState<Distributor[]>([])
  const [commerce, setCommerce] = useState<Commerce | null | undefined>(undefined)
  const [query, setQuery] = useState('')
  const user = useAuthStore((state) => state.user)

  useEffect(() => {
    void api.distributors().then(setDistributors)
    if (user?.role === 'COMMERCE') {
      void api.commerces().then((rows) => setCommerce(rows[0] ?? null))
    }
  }, [user?.role])

  const filtered = distributors.filter((distributor) =>
    [distributor.business_name, distributor.city, distributor.province, distributor.address]
      .join(' ')
      .toLowerCase()
      .includes(query.toLowerCase()),
  )
  const needsGeolocatedAddress = user?.role === 'COMMERCE' && commerce !== undefined && (!commerce?.latitude || !commerce?.longitude)

  return (
    <section className="grid gap-6">
      <div className="grid gap-4 rounded-lg bg-white p-4 shadow-soft md:grid-cols-[1fr_auto] md:items-center">
        <div>
          <p className="text-sm font-800 uppercase text-brand-700">Compra mayorista</p>
          <h1 className="mt-2 text-3xl font-800 text-slate-950">{title}</h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">Abri una distribuidora para ver su catalogo y armar un pedido.</p>
        </div>
        <Link className="inline-flex min-h-11 items-center justify-center rounded-md bg-brand-600 px-4 font-800 text-white" to="/cart">
          Ver carrito
        </Link>
      </div>

      <label className="relative block">
        <Icon name="search" className="pointer-events-none absolute left-3 top-3.5 h-5 w-5 text-slate-400" />
        <input
          className="min-h-12 w-full rounded-lg border border-slate-300 bg-white pl-11 pr-4 text-base"
          placeholder="Buscar distribuidora, zona o direccion"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
        />
      </label>

      {needsGeolocatedAddress ? (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-6">
          <h2 className="text-lg font-800 text-amber-950">Carga tu direccion para ver distribuidoras</h2>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-amber-900">
            Solo mostramos distribuidoras que entregan en tu ubicacion. Guarda una direccion geolocalizada para continuar.
          </p>
          <Link className="mt-4 inline-flex min-h-11 items-center rounded-md bg-amber-900 px-4 text-sm font-800 text-white" to="/account/address">
            Cargar direccion
          </Link>
        </div>
      ) : filtered.length === 0 ? (
        <EmptyState title="No hay distribuidoras" text="Proba con otra busqueda." />
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {filtered.map((distributor) => (
            <article key={distributor.id} className="rounded-lg border border-slate-200 bg-white p-4 shadow-soft">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h2 className="text-lg font-800 text-slate-950">{distributor.business_name}</h2>
                  <p className="mt-1 text-sm text-slate-600">{distributor.address}</p>
                  {(distributor.city || distributor.province) && (
                    <p className="mt-1 text-sm font-700 text-slate-500">
                      {[distributor.city, distributor.province].filter(Boolean).join(', ')}
                    </p>
                  )}
                </div>
                <StatusBadge status={distributor.subscription_status} />
              </div>
              <Link
                className="mt-4 inline-flex min-h-11 items-center rounded-md bg-brand-600 px-4 font-800 text-white"
                to={`/distributors/${distributor.id}`}
              >
                Ver catalogo
              </Link>
            </article>
          ))}
        </div>
      )}
    </section>
  )
}

export function DistributorCatalogPage() {
  const { id } = useParams()
  const [distributor, setDistributor] = useState<Distributor | null>(null)
  const [products, setProducts] = useState<Product[]>([])
  const [query, setQuery] = useState('')
  const add = useCartStore((state) => state.add)
  const showSuccess = useFeedbackStore((state) => state.success)
  const showError = useFeedbackStore((state) => state.error)

  useEffect(() => {
    if (!id) return
    void api.distributor(id).then(setDistributor)
    void api.products(`?distributor=${id}`).then(setProducts)
  }, [id])

  const filtered = products.filter((product) =>
    [product.name, product.category, product.subcategory, product.supplier_name, product.brand, product.sku]
      .join(' ')
      .toLowerCase()
      .includes(query.toLowerCase()),
  )

  function addProduct(product: Product) {
    if (productAvailable(product) <= 0) {
      showError('Este producto no tiene stock disponible para venta.')
      return
    }
    const result = add(product)
    showSuccess(result === 'replaced' ? `Empezaste un pedido con ${product.distributor_name}.` : `${product.name} se sumo al pedido.`)
  }

  return (
    <section className="grid gap-6">
      <div className="grid gap-4 rounded-lg bg-white p-4 shadow-soft md:grid-cols-[1fr_auto] md:items-center">
        <div>
          <Link className="text-sm font-800 text-brand-700" to="/home">
            Volver a distribuidoras
          </Link>
          <h1 className="mt-2 text-3xl font-800 text-slate-950">{distributor?.business_name ?? 'Catalogo'}</h1>
          {distributor && <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">{distributor.address}</p>}
        </div>
        <Link className="inline-flex min-h-11 items-center justify-center rounded-md bg-brand-600 px-4 font-800 text-white" to="/cart">
          Ver carrito
        </Link>
      </div>

      <label className="relative block">
        <Icon name="search" className="pointer-events-none absolute left-3 top-3.5 h-5 w-5 text-slate-400" />
        <input
          className="min-h-12 w-full rounded-lg border border-slate-300 bg-white pl-11 pr-4 text-base"
          placeholder="Buscar producto, codigo, marca o categoria"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
        />
      </label>

      {filtered.length === 0 ? (
        <EmptyState title="No encontramos productos" text="Proba con otra busqueda." />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {filtered.map((product) => (
            <ProductCard key={product.id} product={product} onAdd={addProduct} />
          ))}
        </div>
      )}
    </section>
  )
}

export function ProductDetailPage() {
  const { id } = useParams()
  const [product, setProduct] = useState<Product | null>(null)
  const add = useCartStore((state) => state.add)
  const showSuccess = useFeedbackStore((state) => state.success)
  const showError = useFeedbackStore((state) => state.error)

  useEffect(() => {
    if (id) void api.product(id).then(setProduct)
  }, [id])

  function addProduct(nextProduct: Product) {
    if (productAvailable(nextProduct) <= 0) {
      showError('Este producto no tiene stock disponible para venta.')
      return
    }
    const result = add(nextProduct)
    showSuccess(result === 'replaced' ? `Empezaste un pedido con ${nextProduct.distributor_name}.` : `${nextProduct.name} se sumo al pedido.`)
  }

  if (!product) return <EmptyState title="Cargando producto" text="Estamos consultando stock y precio." />

  return (
    <section className="grid gap-6 lg:grid-cols-[0.9fr_1.1fr]">
      <img
        className="h-80 w-full rounded-lg object-cover shadow-soft"
        src={product.image_url || 'https://images.unsplash.com/photo-1542838132-92c53300491e?auto=format&fit=crop&w=900&q=80'}
        alt={product.name}
      />
      <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-soft">
        <Link className="text-sm font-800 text-brand-700" to={`/distributors/${product.distributor}`}>
          Volver al catalogo
        </Link>
        <p className="mt-4 text-sm font-800 uppercase text-brand-700">{product.category}</p>
        <h1 className="mt-2 text-3xl font-800 text-slate-950">{product.name}</h1>
        <p className="mt-2 text-sm font-700 text-slate-500">{[product.distributor_name, product.supplier_name].filter(Boolean).join(' · ')}</p>
        {product.description && <p className="mt-3 leading-7 text-slate-600">{product.description}</p>}
        {product.characteristics && <p className="mt-3 leading-7 text-slate-600">{product.characteristics}</p>}
        <div className="mt-5 grid gap-3 rounded-lg border border-brand-100 bg-brand-50 p-4 sm:grid-cols-[1fr_auto] sm:items-end">
          <div>
            <p className="text-xs font-800 uppercase text-brand-700">Precio por {product.unit || 'bulto'}</p>
            <p className="mt-1 text-3xl font-800 text-slate-950">{formatMoney(product.price)}</p>
            <p className="mt-1 text-base font-800 text-emerald-700">{unitPriceLabel(product)}</p>
          </div>
          <div className="rounded-md bg-white px-3 py-2 text-sm font-800 text-slate-700 shadow-soft">
            {packageLabel(product)}
          </div>
        </div>
        <dl className="mt-5 grid grid-cols-2 gap-3 text-sm">
          <Info label="Codigo" value={product.sku} />
          <Info label="Marca" value={product.brand || 'Sin marca'} />
          <Info label="Subcategoria" value={product.subcategory || 'Sin subcategoria'} />
          <Info label="Presentacion" value={packageLabel(product)} />
          <Info label="Medidas" value={`${Number(product.length).toLocaleString('es-AR')} x ${Number(product.width).toLocaleString('es-AR')} x ${Number(product.height).toLocaleString('es-AR')} ${product.dimension_unit}`} />
          <Info label="Peso" value={`${Number(product.weight).toLocaleString('es-AR')} ${product.weight_unit}`} />
          <Info label="Precio unitario" value={unitPriceLabel(product)} />
          <Info label="Pallet" value={`${product.packages_per_pallet ?? 0} bultos / ${product.units_per_pallet ?? 0} unidades`} />
          <Info label="Descuento" value={product.discount_name ? `${product.discount_name} · ${Number(product.discount_percent).toLocaleString('es-AR')}%` : `${Number(product.discount_percent).toLocaleString('es-AR')}%`} />
          <Info label="Disponible" value={`${Number(product.stock_available).toLocaleString('es-AR')} ${product.unit}`} />
        </dl>
        <div className="mt-6 flex flex-wrap items-center justify-between gap-4">
          <p className="text-sm font-800 text-slate-600">
            Disponible: {productAvailable(product).toLocaleString('es-AR')} {product.unit}
          </p>
          <button
            className="min-h-12 rounded-md bg-brand-600 px-5 font-800 text-white disabled:bg-slate-300 disabled:text-slate-600"
            disabled={productAvailable(product) <= 0}
            type="button"
            onClick={() => addProduct(product)}
          >
            {productAvailable(product) <= 0 ? 'Sin stock' : 'Sumar al pedido'}
          </button>
        </div>
      </div>
    </section>
  )
}

export function CartPage() {
  const items = useCartStore((state) => state.items)
  const remove = useCartStore((state) => state.remove)
  const setQuantity = useCartStore((state) => state.setQuantity)
  const total = useCartStore((state) => state.total)
  const distributorId = useCartStore((state) => state.distributorId())
  const distributorName = useCartStore((state) => state.distributorName())

  if (items.length === 0) return <EmptyState title="Carrito vacio" text="Elegi una distribuidora y suma productos." />

  return (
    <section className="grid gap-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-800 text-slate-950">Carrito</h1>
          <p className="mt-1 text-sm font-700 text-slate-600">{distributorName}</p>
        </div>
        {distributorId && (
          <Link
            className="inline-flex min-h-11 items-center justify-center rounded-md border border-brand-200 px-4 text-sm font-800 text-brand-700"
            to={`/distributors/${distributorId}`}
          >
            Seguir comprando
          </Link>
        )}
      </div>
      <div className="grid gap-3">
        {items.map((item) => (
          <article key={item.product.id} className="grid gap-3 rounded-lg border border-slate-200 bg-white p-4 shadow-soft md:grid-cols-[1fr_8rem_auto_auto] md:items-center">
            <div>
              <h2 className="font-800 text-slate-950">{item.product.name}</h2>
              <p className="mt-1 text-sm font-700 text-slate-600">
                {packageLabel(item.product)} - {formatMoney(item.product.price)} por {item.product.unit}
              </p>
              <p className="mt-1 text-sm font-800 text-emerald-700">{unitPriceLabel(item.product)}</p>
            </div>
            <div className="text-sm md:text-right">
              <p className="font-700 text-slate-500">Subtotal</p>
              <p className="font-800 text-slate-950">
                {formatMoney(productPrice(item.product) * item.quantity)}
              </p>
            </div>
            <input
              aria-label={`Cantidad de ${item.product.name}`}
              className="min-h-11 w-28 rounded-md border border-slate-300 px-3"
              max={Math.max(1, productAvailable(item.product))}
              min={1}
              type="number"
              value={item.quantity}
              onChange={(event) => setQuantity(item.product.id, Math.min(Number(event.target.value), productAvailable(item.product)))}
            />
            <button className="min-h-11 rounded-md border border-red-200 px-3 font-800 text-red-700" type="button" onClick={() => remove(item.product.id)}>
              Quitar
            </button>
          </article>
        ))}
      </div>
      <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-soft">
        <p className="text-sm font-700 text-slate-500">Total estimado</p>
        <p className="mt-1 text-3xl font-800 text-slate-950">{formatMoney(total())}</p>
        <Link className="mt-4 inline-flex min-h-12 items-center rounded-md bg-brand-600 px-5 font-800 text-white" to="/checkout">
          Seguir con el pedido
        </Link>
      </div>
    </section>
  )
}

export function CommerceAddressPage() {
  const [commerce, setCommerce] = useState<Commerce | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [loadFailed, setLoadFailed] = useState(false)
  const showSuccess = useFeedbackStore((state) => state.success)
  const showError = useFeedbackStore((state) => state.error)

  async function load() {
    setLoading(true)
    try {
      const rows = await api.commerces()
      setCommerce(rows[0] ?? null)
      setLoadFailed(false)
    } catch (caught) {
      setLoadFailed(true)
      showError(caught instanceof Error ? caught.message : 'No pudimos cargar tu direccion.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void load()
  }, [])

  async function saveAddress(value: {
    postal_code: string
    address: string
    city: string
    province: string
    latitude: string | null
    longitude: string | null
    notes: string
  }) {
    if (!commerce) return
    setSaving(true)
    try {
      const updated = await api.update<Commerce>('commerces', commerce.id, {
        postal_code: value.postal_code,
        address: value.address,
        city: value.city,
        province: value.province,
        latitude: value.latitude,
        longitude: value.longitude,
        delivery_notes: value.notes,
      })
      setCommerce(updated)
      showSuccess('Direccion actualizada y geolocalizada.')
    } catch (caught) {
      showError(caught instanceof Error ? caught.message : 'No se pudo guardar la direccion.')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return <div className="rounded-lg border border-slate-200 bg-white p-6 text-sm font-700 text-slate-600">Cargando direccion...</div>
  }

  if (!commerce) {
    return loadFailed ? (
      <EmptyState title="No pudimos cargar tu direccion" text="Intenta de nuevo en unos segundos." />
    ) : (
      <EmptyState title="No encontramos tu perfil comercial" text="Cuando tu cuenta tenga un comercio asociado, vas a poder cargar la direccion desde aca." />
    )
  }

  return (
    <section className="grid gap-5">
      <div>
        <p className="text-sm font-800 uppercase text-brand-700">Mi direccion</p>
        <h1 className="mt-2 text-2xl font-800 text-slate-950">Direccion de entrega del cliente</h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">Antes de pedir, tu direccion debe quedar geolocalizada. Desde aca tambien ajustas indicaciones de entrega.</p>
      </div>

      <AddressEditor
        title={commerce.address ? 'Editar direccion de entrega' : 'Cargar direccion de entrega'}
        description="Usamos el codigo postal para traer opciones de localidad y despues validamos la calle con georreferenciacion antes de guardar."
        notesLabel="Indicaciones adicionales"
        saveLabel="Guardar direccion"
        initialValue={{
          postal_code: commerce.postal_code ?? '',
          address: commerce.address ?? '',
          city: commerce.city ?? '',
          province: commerce.province ?? '',
          latitude: commerce.latitude,
          longitude: commerce.longitude,
          notes: commerce.delivery_notes ?? '',
        }}
        saving={saving}
        error=""
        message=""
        onSave={saveAddress}
      />
    </section>
  )
}

export function CheckoutPage() {
  const items = useCartStore((state) => state.items)
  const clear = useCartStore((state) => state.clear)
  const createFromCart = useOrderStore((state) => state.createFromCart)
  const navigate = useNavigate()
  const [commerce, setCommerce] = useState<Commerce | null>(null)
  const [loading, setLoading] = useState(true)
  const [notes, setNotes] = useState('')
  const [dispatchDate, setDispatchDate] = useState(defaultDispatchDate())
  const [windowStart, setWindowStart] = useState('')
  const [windowEnd, setWindowEnd] = useState('')
  const distributor = items[0]?.product.distributor

  useEffect(() => {
    void api
      .commerces()
      .then((rows) => {
        const current = rows[0] as Commerce | undefined
        setCommerce(current ?? null)
        if (!current) return
        setWindowStart(current.default_window_start ?? '')
        setWindowEnd(current.default_window_end ?? '')
        setNotes(current.delivery_notes ?? '')
      })
      .finally(() => setLoading(false))
  }, [])

  async function submit() {
    const hasWindow = Boolean(windowStart && windowEnd)
    const order = await createFromCart({
      distributor,
      dispatch_date: dispatchDate,
      delivery_window_start: hasWindow ? windowStart : null,
      delivery_window_end: hasWindow ? windowEnd : null,
      notes,
      line_items: items.map((item) => ({ product_id: item.product.id, quantity: item.quantity })),
    })
    clear()
    navigate(`/tracking/${order.id}`)
  }

  if (items.length === 0) return <EmptyState title="Carrito vacio" text="Suma productos de una distribuidora para continuar." />
  if (loading) return <div className="rounded-lg border border-slate-200 bg-white p-6 text-sm font-700 text-slate-600">Cargando checkout...</div>
  if (!commerce) return <EmptyState title="No encontramos tu direccion" text="Carga tu direccion antes de enviar pedidos." />
  if (!commerce.latitude || !commerce.longitude) {
    return (
      <section className="grid gap-5">
        <div className="rounded-[1.75rem] border border-amber-200 bg-amber-50 p-6 shadow-soft">
          <p className="text-sm font-800 uppercase tracking-[0.14em] text-amber-900">Direccion pendiente</p>
          <h1 className="mt-3 text-2xl font-800 text-amber-950">No puedes pedir hasta geolocalizar tu direccion.</h1>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-amber-900">
            Para que la distribuidora pueda rutear correctamente, primero debes guardar una direccion con coordenadas validas.
          </p>
          <Link className="mt-5 inline-flex min-h-11 items-center rounded-full bg-amber-900 px-5 text-sm font-800 text-white" to="/account/address">
            Cargar direccion ahora
          </Link>
        </div>
        <OrderSummary />
      </section>
    )
  }

  return (
    <section className="grid gap-5 lg:grid-cols-[1fr_360px]">
      <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-soft">
        <h1 className="text-2xl font-800 text-slate-950">Confirmar pedido</h1>
        <p className="mt-2 text-sm leading-6 text-slate-600">El pedido se envia a una sola distribuidora.</p>
        <div className="mt-5 grid gap-4">
          <div className="rounded-[1.25rem] border border-emerald-200 bg-emerald-50 px-4 py-4 text-sm text-emerald-950">
            <p className="font-800">Direccion geolocalizada</p>
            <p className="mt-1">{commerce.address}</p>
            <p className="mt-1">{[commerce.city, commerce.province, commerce.postal_code].filter(Boolean).join(' · ')}</p>
            <Link className="mt-3 inline-flex font-800 text-emerald-900" to="/account/address">
              Editar direccion
            </Link>
          </div>
          <label className="grid gap-1 text-sm font-700 text-slate-700">
            Fecha de reparto
            <input className="min-h-12 rounded-md border border-slate-300 px-3" type="date" value={dispatchDate} onChange={(event) => setDispatchDate(event.target.value)} required />
          </label>
          <div className="grid gap-4 md:grid-cols-2">
            <label className="grid gap-1 text-sm font-700 text-slate-700">
              Franja desde
              <input className="min-h-12 rounded-md border border-slate-300 px-3" type="time" value={windowStart} onChange={(event) => setWindowStart(event.target.value)} />
            </label>
            <label className="grid gap-1 text-sm font-700 text-slate-700">
              Franja hasta
              <input className="min-h-12 rounded-md border border-slate-300 px-3" type="time" value={windowEnd} onChange={(event) => setWindowEnd(event.target.value)} />
            </label>
          </div>
          <label className="grid gap-1 text-sm font-700 text-slate-700">
            Notas
            <textarea className="min-h-28 rounded-md border border-slate-300 px-3 py-2" value={notes} onChange={(event) => setNotes(event.target.value)} />
          </label>
          <button className="min-h-12 rounded-md bg-brand-600 px-5 font-800 text-white" type="button" onClick={() => void submit()}>
            Enviar pedido
          </button>
        </div>
      </div>
      <OrderSummary />
    </section>
  )
}

export function OrdersPage() {
  const orders = useOrderStore((state) => state.orders)
  const fetchOrders = useOrderStore((state) => state.fetchOrders)
  const loading = useOrderStore((state) => state.loading)
  const [statusFilter, setStatusFilter] = useState('ALL')
  const [query, setQuery] = useState('')

  useEffect(() => {
    void fetchOrders()
  }, [fetchOrders])

  const metrics = useMemo(
    () =>
      orders.reduce(
        (accumulator, order) => {
          accumulator.total += 1
          if (customerOrderFilterMatches(order.status, 'OPEN')) accumulator.open += 1
          if (order.status === 'ON_THE_WAY') accumulator.onTheWay += 1
          if (order.status === 'DELIVERED') accumulator.delivered += 1
          if (customerOrderFilterMatches(order.status, 'ISSUES')) accumulator.issues += 1
          return accumulator
        },
        { total: 0, open: 0, onTheWay: 0, delivered: 0, issues: 0 },
      ),
    [orders],
  )

  const visibleOrders = useMemo(() => {
    const normalizedQuery = query.trim().toLocaleLowerCase()
    return orders
      .filter((order) => {
        if (!customerOrderFilterMatches(order.status, statusFilter)) return false
        if (!normalizedQuery) return true
        return [String(order.id), order.distributor_name, order.delivery_address, order.items.map((item) => item.product_name).join(' ')]
          .filter(Boolean)
          .some((value) => value.toLocaleLowerCase().includes(normalizedQuery))
      })
      .sort(compareCustomerOrders)
  }, [orders, query, statusFilter])

  return (
    <section className="grid gap-5">
      <div className="grid gap-4 border-b border-slate-200 pb-5 lg:grid-cols-[1fr_auto] lg:items-end">
        <div>
          <h1 className="text-2xl font-800 text-slate-950">Pedidos</h1>
          <p className="mt-1 max-w-2xl text-sm leading-6 text-slate-600">Seguimiento rapido de compras, entregas y pedidos pendientes.</p>
        </div>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
          <CustomerOrderMetric active={statusFilter === 'ALL'} label="Total" value={metrics.total} onClick={() => setStatusFilter('ALL')} />
          <CustomerOrderMetric active={statusFilter === 'OPEN'} label="En curso" value={metrics.open} tone="accent" onClick={() => setStatusFilter('OPEN')} />
          <CustomerOrderMetric label="En camino" value={metrics.onTheWay} tone="success" onClick={() => setStatusFilter('OPEN')} />
          <CustomerOrderMetric active={statusFilter === 'DELIVERED'} label="Entregados" value={metrics.delivered} onClick={() => setStatusFilter('DELIVERED')} />
          <CustomerOrderMetric active={statusFilter === 'ISSUES'} label="Problemas" value={metrics.issues} tone="danger" onClick={() => setStatusFilter('ISSUES')} />
        </div>
      </div>

      <section className="grid gap-3 rounded-lg border border-slate-200 bg-white p-4 shadow-soft">
        <div className="flex flex-wrap gap-2">
          {customerOrderFilterOptions.map((option) => (
            <button
              key={option.id}
              className={`min-h-10 rounded-md border px-3 text-sm font-800 transition ${
                statusFilter === option.id ? 'border-brand-600 bg-brand-50 text-brand-700' : 'border-slate-200 bg-white text-slate-600 hover:border-brand-300 hover:text-brand-700'
              }`}
              type="button"
              aria-pressed={statusFilter === option.id}
              onClick={() => setStatusFilter(option.id)}
            >
              {option.label} <span className="text-xs font-800 text-slate-400">{orders.filter((order) => customerOrderFilterMatches(order.status, option.id)).length}</span>
            </button>
          ))}
        </div>
        <label className="grid gap-1 text-sm font-700 text-slate-700">
          Buscar pedido
          <input
            className="min-h-11 rounded-md border border-slate-300 px-3"
            type="search"
            value={query}
            placeholder="Numero, distribuidora, direccion o producto"
            onChange={(event) => setQuery(event.target.value)}
          />
        </label>
      </section>

      {loading ? (
        <div className="rounded-lg border border-slate-200 bg-white p-6 text-sm font-700 text-slate-600">Cargando pedidos...</div>
      ) : orders.length === 0 ? (
        <EmptyState title="Sin pedidos" text="Tus pedidos van a aparecer aca cuando se confirmen." />
      ) : visibleOrders.length === 0 ? (
        <EmptyState title="Sin pedidos con estos filtros" text="Cambia el estado o la busqueda para revisar tus compras." />
      ) : (
        <div className="grid gap-3">
          {visibleOrders.map((order) => (
            <OrderRow key={order.id} order={order} />
          ))}
        </div>
      )}
    </section>
  )
}

function ProductCard({ product, onAdd }: { product: Product; onAdd: (product: Product) => void }) {
  const available = productAvailable(product)
  return (
    <article className="flex h-full flex-col overflow-hidden rounded-lg border border-slate-200 bg-white shadow-soft">
      <img
        className="h-40 w-full object-cover"
        src={product.image_url || 'https://images.unsplash.com/photo-1542838132-92c53300491e?auto=format&fit=crop&w=900&q=80'}
        alt={product.name}
      />
      <div className="grid flex-1 gap-4 p-4">
        <div>
          <p className="text-xs font-800 uppercase text-brand-700">{product.category}</p>
          <h2 className="mt-1 text-lg font-800 text-slate-950">{product.name}</h2>
          <p className="mt-1 text-sm text-slate-600">Codigo {product.sku}</p>
        </div>

        <div className="rounded-md border border-slate-200 bg-slate-50 p-3">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-xs font-800 uppercase text-slate-500">Presentacion</p>
              <p className="mt-1 text-sm font-800 text-slate-950">{packageLabel(product)}</p>
            </div>
            <div className="text-right">
              <p className="text-xs font-800 uppercase text-slate-500">Disponible</p>
              <p className="mt-1 text-sm font-800 text-slate-950">
                {available.toLocaleString('es-AR')} {product.unit}
              </p>
            </div>
          </div>
          <div className="mt-3 border-t border-slate-200 pt-3">
            <p className="text-xs font-800 uppercase text-slate-500">Precio por {product.unit || 'bulto'}</p>
            <p className="text-2xl font-800 text-slate-950">{formatMoney(product.price)}</p>
            <p className="mt-1 text-sm font-800 text-emerald-700">{unitPriceLabel(product)}</p>
          </div>
        </div>

        <div className="mt-auto grid grid-cols-2 gap-2">
          <Link
            className="min-h-11 rounded-md border border-slate-300 px-3 py-2 text-center text-sm font-800 text-slate-700"
            to={`/products/${product.id}`}
          >
            Ver detalle
          </Link>
          <button
            className="min-h-11 rounded-md bg-brand-600 px-3 text-sm font-800 text-white disabled:bg-slate-300 disabled:text-slate-600"
            disabled={available <= 0}
            type="button"
            onClick={() => onAdd(product)}
          >
            {available <= 0 ? 'Sin stock' : 'Agregar'}
          </button>
        </div>
      </div>
    </article>
  )
}

function productAvailable(product: Product) {
  const parsed = Number(product.stock_available ?? 0)
  return Number.isFinite(parsed) ? parsed : 0
}

function productPrice(product: Product) {
  const parsed = Number(product.price ?? 0)
  return Number.isFinite(parsed) ? parsed : 0
}

function unitsPerPackage(product: Product) {
  const parsed = Number(product.units_per_package ?? 1)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 1
}

function unitPrice(product: Product) {
  return productPrice(product) / unitsPerPackage(product)
}

function formatMoney(value: string | number | null | undefined) {
  const amount = Number(value ?? 0)
  if (!Number.isFinite(amount)) return '$0'
  const hasDecimals = Math.abs(amount % 1) > 0
  return `$${amount.toLocaleString('es-AR', {
    minimumFractionDigits: hasDecimals ? 2 : 0,
    maximumFractionDigits: 2,
  })}`
}

function formatQuantity(value: string | number | null | undefined) {
  const amount = Number(value ?? 0)
  if (!Number.isFinite(amount)) return '0'
  return amount.toLocaleString('es-AR', { maximumFractionDigits: 2 })
}

function customerOrderFilterMatches(status: string, filterId: string) {
  const filter = customerOrderFilterOptions.find((option) => option.id === filterId)
  if (!filter || filter.id === 'ALL') return true
  return filter.statuses.includes(status)
}

function compareCustomerOrders(left: Order, right: Order) {
  const statusDifference = (customerOrderStatusPriority[left.status] ?? 99) - (customerOrderStatusPriority[right.status] ?? 99)
  if (statusDifference !== 0) return statusDifference
  const leftDate = left.dispatch_date || '9999-12-31'
  const rightDate = right.dispatch_date || '9999-12-31'
  if (leftDate !== rightDate) return leftDate.localeCompare(rightDate)
  return Number(right.id) - Number(left.id)
}

function customerOrderStatusLabel(status: string) {
  const labels: Record<string, string> = {
    PENDING: 'Pendiente',
    ACCEPTED: 'Aceptado',
    PREPARING: 'Preparando',
    SCHEDULED: 'Programado',
    ON_THE_WAY: 'En camino',
    DELIVERED: 'Entregado',
    REJECTED: 'Rechazado',
    CANCELLED: 'Cancelado',
  }
  return labels[status] ?? status
}

function customerOrderDateLabel(value: string | null | undefined) {
  if (!value) return 'Sin fecha'
  const date = new Date(`${value}T00:00:00`)
  if (Number.isNaN(date.getTime())) return value
  return date.toLocaleDateString('es-AR')
}

function customerOrderSlotLabel(order: Order) {
  if (order.delivery_slot_name) {
    return [order.delivery_slot_name, customerOrderWindowLabel(order.delivery_slot_start_time, order.delivery_slot_end_time)].filter(Boolean).join(' ')
  }
  return customerOrderWindowLabel(order.delivery_window_start, order.delivery_window_end)
}

function customerOrderWindowLabel(start: string | null | undefined, end: string | null | undefined) {
  if (!start || !end) return 'Sin franja'
  return `${String(start).slice(0, 5)}-${String(end).slice(0, 5)}`
}

function packageLabel(product: Product) {
  const unit = product.unit?.trim() || 'bulto'
  const units = unitsPerPackage(product)
  if (units <= 1) return capitalize(unit)
  const saleUnit = unit.toLowerCase().startsWith('unidad') ? 'pack' : unit
  return `${capitalize(saleUnit)} x ${units.toLocaleString('es-AR')} unidades`
}

function unitPriceLabel(product: Product) {
  const units = unitsPerPackage(product)
  if (units <= 1) return `${formatMoney(unitPrice(product))} por ${product.unit || 'unidad'}`
  return `${formatMoney(unitPrice(product))} por unidad`
}

function capitalize(value: string) {
  if (!value) return value
  return `${value.charAt(0).toUpperCase()}${value.slice(1)}`
}

function OrderSummary() {
  const items = useCartStore((state) => state.items)
  const total = useCartStore((state) => state.total)
  return (
    <aside className="rounded-lg border border-slate-200 bg-white p-5 shadow-soft">
      <h2 className="text-lg font-800 text-slate-950">Resumen</h2>
      <div className="mt-4 grid gap-3">
        {items.map((item) => (
          <div key={item.product.id} className="flex justify-between gap-3 text-sm">
            <span className="grid gap-1 font-700 text-slate-700">
              {item.quantity} x {item.product.name}
              <span className="text-xs font-800 text-emerald-700">
                {packageLabel(item.product)} - {unitPriceLabel(item.product)}
              </span>
            </span>
            <span className="font-800 text-slate-950">{formatMoney(productPrice(item.product) * item.quantity)}</span>
          </div>
        ))}
      </div>
      <div className="mt-5 border-t border-slate-200 pt-4">
        <p className="flex justify-between text-lg font-800 text-slate-950">
          <span>Total</span>
          <span>{formatMoney(total())}</span>
        </p>
      </div>
    </aside>
  )
}

function CustomerOrderMetric({
  label,
  value,
  active = false,
  tone = 'neutral',
  onClick,
}: {
  label: string
  value: number
  active?: boolean
  tone?: 'neutral' | 'accent' | 'success' | 'danger'
  onClick: () => void
}) {
  const toneClass =
    tone === 'success'
      ? 'text-emerald-700'
      : tone === 'danger'
        ? 'text-red-700'
        : tone === 'accent'
          ? 'text-brand-700'
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

function OrderRow({ order }: { order: Order }) {
  const itemPreview = order.items.slice(0, 2)
  const remainingItems = order.items.length - itemPreview.length
  const totalQuantity = order.items.reduce((total, item) => total + Number(item.quantity ?? 0), 0)
  const isTrackable = !['REJECTED', 'CANCELLED'].includes(order.status)

  return (
    <article className="grid gap-4 rounded-lg border border-slate-200 bg-white p-4 shadow-soft transition hover:border-brand-200">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-lg font-800 text-slate-950">Pedido #{order.id}</h2>
            <StatusBadge status={order.status} />
          </div>
          <p className="mt-1 text-sm font-700 text-slate-700">{order.distributor_name || order.commerce_name}</p>
          <p className="mt-1 line-clamp-2 text-sm text-slate-500">{order.delivery_address || 'Sin direccion registrada'}</p>
        </div>
        <div className="text-right">
          <p className="text-xs font-800 uppercase text-slate-500">Total</p>
          <p className="text-lg font-800 text-slate-950">{formatMoney(order.total)}</p>
        </div>
      </div>

      <div className="grid gap-3 rounded-md bg-slate-50 p-3 md:grid-cols-3">
        <Info label="Entrega" value={customerOrderDateLabel(order.dispatch_date)} />
        <Info label="Franja" value={customerOrderSlotLabel(order)} />
        <Info label="Estado" value={customerOrderStatusLabel(order.status)} />
      </div>

      <div className="grid gap-2">
        <div className="flex flex-wrap items-center justify-between gap-2 text-xs font-800 text-slate-500">
          <span>{order.items.length} productos</span>
          <span>{formatQuantity(totalQuantity)} unidades</span>
        </div>
        {itemPreview.length === 0 ? (
          <p className="rounded-md border border-dashed border-slate-300 px-3 py-2 text-sm font-700 text-slate-500">Sin detalle de productos.</p>
        ) : (
          itemPreview.map((item) => (
            <div key={item.id} className="flex flex-wrap items-start justify-between gap-2 rounded-md border border-slate-200 px-3 py-2 text-sm">
              <span className="font-800 text-slate-800">{item.product_name}</span>
              <span className="font-700 text-slate-500">
                {formatQuantity(item.quantity)} u. - {formatMoney(item.subtotal)}
              </span>
            </div>
          ))
        )}
        {remainingItems > 0 ? <p className="text-xs font-800 text-slate-500">+{remainingItems} productos mas en este pedido.</p> : null}
      </div>

      <div className="flex flex-wrap gap-2">
        {isTrackable ? (
          <Link className="inline-flex min-h-11 items-center rounded-md bg-brand-600 px-4 font-800 text-white" to={`/tracking/${order.id}`}>
            Ver seguimiento
          </Link>
        ) : null}
        <Link className="inline-flex min-h-11 items-center rounded-md border border-slate-300 px-4 font-800 text-slate-700" to={`/distributors/${order.distributor}`}>
          Ver catalogo
        </Link>
      </div>
    </article>
  )
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md bg-slate-50 p-3">
      <dt className="text-xs font-800 uppercase text-slate-500">{label}</dt>
      <dd className="mt-1 font-800 text-slate-950">{value}</dd>
    </div>
  )
}

function defaultDispatchDate() {
  const base = new Date()
  base.setDate(base.getDate() + 1)
  return base.toISOString().slice(0, 10)
}
