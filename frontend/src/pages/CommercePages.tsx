import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'

import { EmptyState } from '../components/EmptyState'
import { Icon } from '../components/Icon'
import { StatusBadge } from '../components/StatusBadge'
import { api } from '../services/api'
import { useCartStore } from '../stores/cartStore'
import { useOrderStore } from '../stores/orderStore'
import type { Distributor, Order, Product } from '../types/domain'

export function HomePage() {
  return <DistributorsDirectory title="Elegi una distribuidora" />
}

export function DistributorsPage() {
  return <DistributorsDirectory title="Distribuidoras" />
}

function DistributorsDirectory({ title }: { title: string }) {
  const [distributors, setDistributors] = useState<Distributor[]>([])
  const [query, setQuery] = useState('')

  useEffect(() => {
    void api.distributors().then(setDistributors)
  }, [])

  const filtered = distributors.filter((distributor) =>
    [distributor.business_name, distributor.city, distributor.province, distributor.address]
      .join(' ')
      .toLowerCase()
      .includes(query.toLowerCase()),
  )

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

      {filtered.length === 0 ? (
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
  const [notice, setNotice] = useState('')
  const add = useCartStore((state) => state.add)

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
    const result = add(product)
    setNotice(result === 'replaced' ? `Empezaste un pedido con ${product.distributor_name}.` : `${product.name} se sumo al pedido.`)
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

      {notice && <p className="rounded-md bg-mint-50 px-3 py-2 text-sm font-800 text-mint-700">{notice}</p>}

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
  const [notice, setNotice] = useState('')
  const add = useCartStore((state) => state.add)

  useEffect(() => {
    if (id) void api.product(id).then(setProduct)
  }, [id])

  function addProduct(nextProduct: Product) {
    const result = add(nextProduct)
    setNotice(result === 'replaced' ? `Empezaste un pedido con ${nextProduct.distributor_name}.` : `${nextProduct.name} se sumo al pedido.`)
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
        <dl className="mt-5 grid grid-cols-2 gap-3 text-sm">
          <Info label="Codigo" value={product.sku} />
          <Info label="Marca" value={product.brand || 'Sin marca'} />
          <Info label="Subcategoria" value={product.subcategory || 'Sin subcategoria'} />
          <Info label="Presentacion" value={product.package_size || product.unit} />
          <Info label="Medidas" value={`${Number(product.length).toLocaleString('es-AR')} x ${Number(product.width).toLocaleString('es-AR')} x ${Number(product.height).toLocaleString('es-AR')} ${product.dimension_unit}`} />
          <Info label="Peso" value={`${Number(product.weight).toLocaleString('es-AR')} ${product.weight_unit}`} />
          <Info label="Unidades por bulto" value={String(product.units_per_package)} />
          <Info label="Pallet" value={`${product.packages_per_pallet ?? 0} bultos / ${product.units_per_pallet ?? 0} unidades`} />
          <Info label="Descuento" value={product.discount_name ? `${product.discount_name} · ${Number(product.discount_percent).toLocaleString('es-AR')}%` : `${Number(product.discount_percent).toLocaleString('es-AR')}%`} />
          <Info label="Disponible" value={`${Number(product.stock_available).toLocaleString('es-AR')} ${product.unit}`} />
        </dl>
        {notice && <p className="mt-4 rounded-md bg-mint-50 px-3 py-2 text-sm font-800 text-mint-700">{notice}</p>}
        <div className="mt-6 flex flex-wrap items-center justify-between gap-4">
          <p className="text-3xl font-800 text-slate-950">${Number(product.price).toLocaleString('es-AR')}</p>
          <button className="min-h-12 rounded-md bg-brand-600 px-5 font-800 text-white" type="button" onClick={() => addProduct(product)}>
            Sumar al pedido
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
          <article key={item.product.id} className="grid gap-3 rounded-lg border border-slate-200 bg-white p-4 shadow-soft md:grid-cols-[1fr_auto_auto] md:items-center">
            <div>
              <h2 className="font-800 text-slate-950">{item.product.name}</h2>
              <p className="text-sm text-slate-600">
                ${Number(item.product.price).toLocaleString('es-AR')} por {item.product.unit}
              </p>
            </div>
            <input
              className="min-h-11 w-28 rounded-md border border-slate-300 px-3"
              min={1}
              type="number"
              value={item.quantity}
              onChange={(event) => setQuantity(item.product.id, Number(event.target.value))}
            />
            <button className="min-h-11 rounded-md border border-red-200 px-3 font-800 text-red-700" type="button" onClick={() => remove(item.product.id)}>
              Quitar
            </button>
          </article>
        ))}
      </div>
      <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-soft">
        <p className="text-sm font-700 text-slate-500">Total estimado</p>
        <p className="mt-1 text-3xl font-800 text-slate-950">${total().toLocaleString('es-AR')}</p>
        <Link className="mt-4 inline-flex min-h-12 items-center rounded-md bg-brand-600 px-5 font-800 text-white" to="/checkout">
          Seguir con el pedido
        </Link>
      </div>
    </section>
  )
}

export function CheckoutPage() {
  const items = useCartStore((state) => state.items)
  const clear = useCartStore((state) => state.clear)
  const createFromCart = useOrderStore((state) => state.createFromCart)
  const navigate = useNavigate()
  const [notes, setNotes] = useState('')
  const [address, setAddress] = useState('Humboldt 1400, CABA')
  const distributor = items[0]?.product.distributor

  async function submit() {
    const order = await createFromCart({
      distributor,
      delivery_address: address,
      notes,
      line_items: items.map((item) => ({ product_id: item.product.id, quantity: item.quantity })),
    })
    clear()
    navigate(`/tracking/${order.id}`)
  }

  if (items.length === 0) return <EmptyState title="Carrito vacio" text="Suma productos de una distribuidora para continuar." />

  return (
    <section className="grid gap-5 lg:grid-cols-[1fr_360px]">
      <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-soft">
        <h1 className="text-2xl font-800 text-slate-950">Confirmar pedido</h1>
        <p className="mt-2 text-sm leading-6 text-slate-600">El pedido se envia a una sola distribuidora.</p>
        <div className="mt-5 grid gap-4">
          <label className="grid gap-1 text-sm font-700 text-slate-700">
            Direccion de entrega
            <input className="min-h-12 rounded-md border border-slate-300 px-3" value={address} onChange={(event) => setAddress(event.target.value)} />
          </label>
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
  useEffect(() => {
    void fetchOrders()
  }, [fetchOrders])
  return (
    <section className="grid gap-4">
      <h1 className="text-2xl font-800 text-slate-950">Pedidos</h1>
      {orders.length === 0 ? (
        <EmptyState title="Sin pedidos" text="Tus pedidos van a aparecer aca cuando se confirmen." />
      ) : (
        <div className="grid gap-3">
          {orders.map((order) => (
            <OrderRow key={order.id} order={order} />
          ))}
        </div>
      )}
    </section>
  )
}

function ProductCard({ product, onAdd }: { product: Product; onAdd: (product: Product) => void }) {
  return (
    <article className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-soft">
      <img
        className="h-40 w-full object-cover"
        src={product.image_url || 'https://images.unsplash.com/photo-1542838132-92c53300491e?auto=format&fit=crop&w=900&q=80'}
        alt={product.name}
      />
      <div className="grid gap-3 p-4">
        <div>
          <p className="text-xs font-800 uppercase text-brand-700">{product.category}</p>
          <h2 className="mt-1 text-lg font-800 text-slate-950">{product.name}</h2>
          <p className="mt-1 text-sm text-slate-600">Codigo {product.sku}</p>
        </div>
        <div className="flex items-end justify-between gap-3">
          <div>
            <p className="text-xs font-700 text-slate-500">Disponible</p>
            <p className="text-sm font-800 text-slate-950">
              {Number(product.stock_available).toLocaleString('es-AR')} {product.unit}
            </p>
          </div>
          <p className="text-xl font-800 text-slate-950">${Number(product.price).toLocaleString('es-AR')}</p>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <Link
            className="min-h-11 rounded-md border border-slate-300 px-3 py-2 text-center text-sm font-800 text-slate-700"
            to={`/products/${product.id}`}
          >
            Ver detalle
          </Link>
          <button
            className="min-h-11 rounded-md bg-brand-600 px-3 text-sm font-800 text-white"
            type="button"
            onClick={() => onAdd(product)}
          >
            Agregar
          </button>
        </div>
      </div>
    </article>
  )
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
            <span className="font-700 text-slate-700">
              {item.quantity} x {item.product.name}
            </span>
            <span className="font-800 text-slate-950">${(Number(item.product.price) * item.quantity).toLocaleString('es-AR')}</span>
          </div>
        ))}
      </div>
      <div className="mt-5 border-t border-slate-200 pt-4">
        <p className="flex justify-between text-lg font-800 text-slate-950">
          <span>Total</span>
          <span>${total().toLocaleString('es-AR')}</span>
        </p>
      </div>
    </aside>
  )
}

function OrderRow({ order }: { order: Order }) {
  return (
    <article className="rounded-lg border border-slate-200 bg-white p-4 shadow-soft">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-800 text-slate-950">Pedido #{order.id}</h2>
          <p className="text-sm text-slate-600">{order.commerce_name || order.distributor_name}</p>
        </div>
        <StatusBadge status={order.status} />
      </div>
      <p className="mt-3 text-sm text-slate-600">
        {order.items.length} productos · ${Number(order.total).toLocaleString('es-AR')}
      </p>
      <Link className="mt-4 inline-flex min-h-11 items-center rounded-md border border-brand-200 px-4 font-800 text-brand-700" to={`/tracking/${order.id}`}>
        Ver seguimiento
      </Link>
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
