import { useEffect, useState } from 'react'
import type { ChangeEvent, ReactNode } from 'react'
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'

import { EmptyState } from '../components/EmptyState'
import { ResourceManager } from '../components/ResourceManager'
import { StatusBadge } from '../components/StatusBadge'
import { useDashboard } from '../hooks/useDashboard'
import { api } from '../services/api'
import type {
  DashboardFilters,
  DashboardPoint,
  ImportJob,
  Order,
  ProductCategory,
  ProductSubCategory,
  ProductSupplier,
  StockItem,
  User,
} from '../types/domain'

type ExportModule = 'sales' | 'customers' | 'products' | 'operations'
type CompactColumn = [key: string, label: string, formatter?: (value: unknown) => string]

export function DashboardPage() {
  const { filters, data, loading, error, setFilters, refresh } = useDashboard()
  const kpis = data?.summary.kpis
  const pipeline = data?.operations.pipeline ?? data?.summary.pipeline ?? []

  return (
    <section className="grid gap-3 text-[12px] leading-5 text-slate-700">
      <div className="flex flex-col gap-2 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-[11px] font-800 uppercase text-brand-700">Panel B2B</p>
          <h1 className="mt-1 text-2xl font-800 text-slate-950">Dashboard distribuidor</h1>
        </div>
        <div className="flex flex-wrap gap-2">
          <button className="min-h-9 rounded-md border border-slate-300 px-3 font-800 text-slate-700" type="button" onClick={() => void refresh()}>
            Actualizar
          </button>
          <ExportButton module="sales" format="csv" label="Ventas CSV" filters={filters} />
          <ExportButton module="products" format="xls" label="Productos Excel" filters={filters} />
        </div>
      </div>

      <div className="grid gap-2 rounded-lg border border-slate-200 bg-white p-3 shadow-soft md:grid-cols-2 xl:grid-cols-4">
        <FilterInput label="Desde" type="date" value={filters.date_from} onChange={(value) => setFilters({ date_from: value })} />
        <FilterInput label="Hasta" type="date" value={filters.date_to} onChange={(value) => setFilters({ date_to: value })} />
        <label className="grid gap-1 font-800 text-slate-600">
          Corte
          <select
            className="min-h-9 rounded-md border border-slate-300 px-2 text-[12px] font-700 text-slate-950"
            value={filters.granularity}
            onChange={(event) => setFilters({ granularity: event.target.value as 'day' | 'week' | 'month' })}
          >
            <option value="day">Dia</option>
            <option value="week">Semana</option>
            <option value="month">Mes</option>
          </select>
        </label>
        <FilterInput label="Zona" value={filters.zone} onChange={(value) => setFilters({ zone: value })} />
      </div>

      {error && <p className="rounded-md bg-red-50 px-3 py-2 font-800 text-red-700">{error}</p>}
      {loading && !data && <p className="rounded-lg border border-slate-200 bg-white p-4 font-800 text-slate-600">Cargando dashboard...</p>}

      <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-7">
        <Kpi label="Ventas hoy" value={money(kpis?.sales_today)} />
        <Kpi label="Ventas mes" value={money(kpis?.sales_month)} />
        <Kpi label="Pedidos" value={num(kpis?.orders)} />
        <Kpi label="Ticket prom." value={money(kpis?.avg_ticket)} />
        <Kpi label="Margen" value={pct(kpis?.gross_margin_percent)} />
        <Kpi label="Clientes activos" value={num(kpis?.active_customers)} />
        <Kpi label="Bajo stock" value={num(kpis?.low_stock_count)} />
      </div>

      <div className="grid gap-3 xl:grid-cols-[1.4fr_0.8fr_0.8fr]">
        <ChartPanel title="Ventas">
          <ResponsiveContainer width="100%" height={220}>
            <LineChart data={data?.sales.series ?? []}>
              <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
              <XAxis dataKey="period" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip formatter={(value) => money(value)} />
              <Line type="monotone" dataKey="sales" stroke="#0369A1" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </ChartPanel>
        <ChartPanel title="Categorias">
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={data?.sales.by_category ?? []}>
              <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
              <XAxis dataKey="name" tick={{ fontSize: 10 }} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip formatter={(value) => money(value)} />
              <Bar dataKey="sales" fill="#059669" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartPanel>
        <ChartPanel title="Estados">
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={pipeline}>
              <XAxis dataKey="status" tick={{ fontSize: 10 }} />
              <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
              <Tooltip />
              <Bar dataKey="count" fill="#0F172A" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartPanel>
      </div>

      <div className="grid gap-3 xl:grid-cols-3">
        <ChartPanel title="Cartera clientes">
          <ResponsiveContainer width="100%" height={210}>
            <PieChart>
              <Pie data={data?.customers.portfolio ?? []} dataKey="value" nameKey="name" outerRadius={78} label>
                {(data?.customers.portfolio ?? []).map((_, index) => (
                  <Cell key={index} fill={['#0369A1', '#059669', '#DC2626'][index % 3]} />
                ))}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        </ChartPanel>
        <CompactTable
          title="Top clientes"
          rows={data?.customers.ranking ?? []}
          columns={[
            ['name', 'Cliente'],
            ['revenue', 'Ingresos', money],
            ['orders', 'Pedidos', num],
          ]}
          exportModule="customers"
          filters={filters}
        />
        <CompactTable
          title="SKUs principales"
          rows={data?.products.top_skus ?? []}
          columns={[
            ['sku', 'SKU'],
            ['name', 'Producto'],
            ['sales', 'Ingresos', money],
            ['margin', 'Margen', money],
          ]}
          exportModule="products"
          filters={filters}
        />
      </div>

      <div className="grid gap-3 xl:grid-cols-3">
        <CompactTable
          title="Ventas por zona"
          rows={data?.sales.by_zone ?? []}
          columns={[
            ['name', 'Zona'],
            ['sales', 'Ventas', money],
          ]}
          exportModule="sales"
          filters={filters}
        />
        <Metric label="Ventas periodo" value={kpis?.sales_period ?? 0} formatter={money} />
        <Metric label="Margen bruto" value={kpis?.gross_margin_amount ?? 0} formatter={money} />
      </div>

      <div className="grid gap-3 xl:grid-cols-4">
        <Metric label="Recompra" value={kpis?.repurchase_rate ?? 0} formatter={pct} />
        <Metric label="Entregas" value={data?.operations.metrics.delivery_count ?? 0} formatter={num} />
        <Metric label="Entregadas" value={data?.operations.metrics.delivered ?? 0} formatter={num} />
        <Metric label="Cancelados" value={data?.operations.metrics.cancellations ?? 0} formatter={num} />
      </div>

      <div className="grid gap-3 xl:grid-cols-3">
        <CompactTable
          title="Quiebres y cobertura"
          rows={data?.products.stock_breaks ?? []}
          columns={[
            ['sku', 'SKU'],
            ['name', 'Producto'],
            ['available', 'Disp.', num],
            ['days_inventory', 'Dias', num],
          ]}
          filters={filters}
        />
        <CompactTable
          title="Choferes"
          rows={data?.operations.riders ?? []}
          columns={[
            ['name', 'Rider'],
            ['deliveries', 'Entregas', num],
            ['delivered', 'OK', num],
          ]}
          exportModule="operations"
          filters={filters}
        />
        <CompactTable
          title="Menor venta"
          rows={data?.sales.bottom_products ?? []}
          columns={[
            ['sku', 'SKU'],
            ['name', 'Producto'],
            ['sales', 'Ingresos', money],
          ]}
          exportModule="sales"
          filters={filters}
        />
      </div>
    </section>
  )
}

export function ProductsManagerPage() {
  const [suppliers, setSuppliers] = useState<ProductSupplier[]>([])
  const [categories, setCategories] = useState<ProductCategory[]>([])
  const [subcategories, setSubcategories] = useState<ProductSubCategory[]>([])

  async function refreshOptions() {
    const [nextSuppliers, nextCategories, nextSubcategories] = await Promise.all([
      api.productSuppliers(),
      api.productCategories(),
      api.productSubCategories(),
    ])
    setSuppliers(nextSuppliers)
    setCategories(nextCategories)
    setSubcategories(nextSubcategories)
  }

  useEffect(() => {
    void refreshOptions()
  }, [])

  const supplierOptions = suppliers.filter((item) => item.active).map((item) => ({ value: String(item.id), label: item.name }))
  const categoryOptions = categories.filter((item) => item.active).map((item) => ({ value: String(item.id), label: item.name }))
  const subcategoryOptions = subcategories
    .filter((item) => item.active)
    .map((item) => ({ value: String(item.id), label: `${item.category_name} / ${item.name}` }))

  return (
    <section className="grid gap-8">
      <ResourceManager
        title="Articulos"
        description="Administra el catalogo de venta, datos volumetricos y embalaje."
        endpoint="products"
        fields={[
          { name: 'sku', label: 'SKU', required: true },
          { name: 'barcode', label: 'Codigo de barras' },
          { name: 'name', label: 'Nombre', required: true },
          { name: 'brand', label: 'Marca' },
          { name: 'supplier', label: 'Proveedor', type: 'select', required: true, options: supplierOptions },
          { name: 'product_category', label: 'Categoria', type: 'select', required: true, options: categoryOptions },
          { name: 'product_subcategory', label: 'Sub categoria', type: 'select', options: subcategoryOptions },
          { name: 'unit', label: 'Unidad de medida', required: true },
          { name: 'package_size', label: 'Presentacion' },
          { name: 'length', label: 'Largo', type: 'number', required: true },
          { name: 'width', label: 'Ancho', type: 'number', required: true },
          { name: 'height', label: 'Alto', type: 'number', required: true },
          {
            name: 'dimension_unit',
            label: 'Unidad largo/ancho/alto',
            type: 'select',
            required: true,
            defaultValue: 'cm',
            options: [
              { value: 'cm', label: 'cm' },
              { value: 'm', label: 'm' },
              { value: 'mm', label: 'mm' },
            ],
          },
          { name: 'weight', label: 'Peso', type: 'number', required: true },
          {
            name: 'weight_unit',
            label: 'Unidad de peso',
            type: 'select',
            required: true,
            defaultValue: 'kg',
            options: [
              { value: 'kg', label: 'kg' },
              { value: 'g', label: 'g' },
            ],
          },
          { name: 'units_per_package', label: 'Unidades por bulto', type: 'number', required: true, defaultValue: 1 },
          { name: 'packages_per_pallet', label: 'Bultos por pallet', type: 'number' },
          { name: 'units_per_pallet', label: 'Unidades por pallet', type: 'number' },
          { name: 'price', label: 'Precio', type: 'number', required: true },
          { name: 'cost', label: 'Costo', type: 'number' },
          { name: 'discount_percent', label: 'Porc. descuento', type: 'number', defaultValue: 0 },
          { name: 'discount_name', label: 'Nombre descuento' },
          { name: 'stock_minimum', label: 'Stock minimo', type: 'number' },
          { name: 'image_url', label: 'URL de imagen' },
          { name: 'characteristics', label: 'Caracteristicas', type: 'textarea' },
          { name: 'description', label: 'Descripcion', type: 'textarea' },
        ]}
        columns={[
          { key: 'sku', label: 'SKU' },
          { key: 'name', label: 'Articulo' },
          { key: 'supplier_name', label: 'Proveedor' },
          { key: 'category', label: 'Categoria' },
          { key: 'subcategory', label: 'Sub categoria' },
          { key: 'price', label: 'Precio' },
          { key: 'cost', label: 'Costo' },
          { key: 'discount_percent', label: 'Desc. %' },
          { key: 'stock_available', label: 'Disponible' },
        ]}
      />

      <div className="grid gap-6 xl:grid-cols-3">
        <ResourceManager
          title="Proveedores"
          description="Configura proveedores para asociarlos a tus articulos."
          endpoint="product-suppliers"
          createLabel="Agregar proveedor"
          onSaved={refreshOptions}
          fields={[
            { name: 'name', label: 'Nombre', required: true },
            { name: 'contact_name', label: 'Contacto' },
            { name: 'phone', label: 'Telefono' },
            { name: 'email', label: 'Email', type: 'email' },
            { name: 'active', label: 'Activo', type: 'checkbox', defaultValue: true },
          ]}
          columns={[
            { key: 'name', label: 'Proveedor' },
            { key: 'contact_name', label: 'Contacto' },
            { key: 'active', label: 'Activo', format: yesNo },
          ]}
        />
        <ResourceManager
          title="Categorias"
          description="Configura categorias propias para ordenar tu catalogo."
          endpoint="product-categories"
          createLabel="Agregar categoria"
          onSaved={refreshOptions}
          fields={[
            { name: 'name', label: 'Nombre', required: true },
            { name: 'active', label: 'Activa', type: 'checkbox', defaultValue: true },
          ]}
          columns={[
            { key: 'name', label: 'Categoria' },
            { key: 'active', label: 'Activa', format: yesNo },
          ]}
        />
        <ResourceManager
          title="Sub categorias"
          description="Configura sub categorias dentro de cada categoria."
          endpoint="product-subcategories"
          createLabel="Agregar sub categoria"
          onSaved={refreshOptions}
          fields={[
            { name: 'category', label: 'Categoria', type: 'select', required: true, options: categoryOptions },
            { name: 'name', label: 'Nombre', required: true },
            { name: 'active', label: 'Activa', type: 'checkbox', defaultValue: true },
          ]}
          columns={[
            { key: 'category_name', label: 'Categoria' },
            { key: 'name', label: 'Sub categoria' },
            { key: 'active', label: 'Activa', format: yesNo },
          ]}
        />
      </div>
    </section>
  )
}

export function CustomersManagerPage() {
  return (
    <ResourceManager
      title="Clientes"
      description="Administra los comercios clientes."
      endpoint="commerces"
      fields={[
        { name: 'trade_name', label: 'Nombre comercial', required: true },
        { name: 'legal_name', label: 'Razon social' },
        { name: 'tax_id', label: 'CUIT / Tax ID' },
        { name: 'contact_name', label: 'Contacto', required: true },
        { name: 'email', label: 'Email', type: 'email' },
        { name: 'phone', label: 'Telefono', required: true },
        { name: 'address', label: 'Direccion', required: true },
        { name: 'city', label: 'Ciudad' },
        { name: 'province', label: 'Provincia' },
        { name: 'delivery_notes', label: 'Notas de entrega', type: 'textarea' },
      ]}
      columns={[
        { key: 'trade_name', label: 'Comercio' },
        { key: 'tax_id', label: 'CUIT' },
        { key: 'phone', label: 'Telefono' },
        { key: 'address', label: 'Direccion' },
      ]}
    />
  )
}

export function VehiclesManagerPage() {
  return (
    <ResourceManager
      title="Vehiculos"
      description="Administra la flota de reparto."
      endpoint="vehicles"
      fields={[
        { name: 'plate', label: 'Patente', required: true },
        { name: 'vehicle_type', label: 'Tipo', required: true },
        { name: 'brand', label: 'Marca' },
        { name: 'model', label: 'Modelo' },
        { name: 'year', label: 'Ano', type: 'number' },
        { name: 'capacity_kg', label: 'Capacidad kg', type: 'number' },
        { name: 'insurance_expires_at', label: 'Vence seguro', type: 'date' },
        { name: 'inspection_expires_at', label: 'Vence VTV', type: 'date' },
      ]}
      columns={[
        { key: 'plate', label: 'Patente' },
        { key: 'vehicle_type', label: 'Tipo' },
        { key: 'brand', label: 'Marca' },
        { key: 'status', label: 'Estado' },
      ]}
    />
  )
}

export function DriversManagerPage() {
  return (
    <ResourceManager
      title="Choferes"
      description="Administra choferes y disponibilidad."
      endpoint="drivers"
      fields={[
        { name: 'email', label: 'Email', type: 'email', required: true },
        { name: 'name', label: 'Nombre completo', required: true },
        { name: 'phone', label: 'Telefono', required: true },
        { name: 'license_number', label: 'Licencia', required: true },
        { name: 'license_category', label: 'Categoria', required: true },
        { name: 'license_expires_at', label: 'Vence licencia', type: 'date' },
        { name: 'emergency_contact', label: 'Contacto emergencia' },
      ]}
      columns={[
        { key: 'full_name', label: 'Chofer' },
        { key: 'license_number', label: 'Licencia' },
        { key: 'phone', label: 'Telefono' },
        { key: 'assigned_vehicle_plate', label: 'Vehiculo' },
      ]}
    />
  )
}

export function StockPage() {
  const [stock, setStock] = useState<StockItem[]>([])
  useEffect(() => {
    void api.stock().then(setStock)
  }, [])
  return (
    <section className="grid gap-5">
      <div>
        <h1 className="text-2xl font-800 text-slate-950">Stock</h1>
        <p className="mt-2 text-sm leading-6 text-slate-600">Revisa existencias, reservas y disponibilidad.</p>
      </div>
      <div className="grid gap-3">
        {stock.map((item) => (
          <article key={item.id} className="rounded-lg border border-slate-200 bg-white p-4 shadow-soft">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-xs font-800 uppercase text-brand-700">{item.sku}</p>
                <h2 className="mt-1 text-lg font-800 text-slate-950">{item.product_name}</h2>
                <p className="text-sm text-slate-600">{item.warehouse_name}</p>
              </div>
              {item.is_low && <span className="rounded-md bg-red-50 px-3 py-1 text-xs font-800 text-red-700">Bajo stock</span>}
            </div>
            <div className="mt-4 grid grid-cols-3 gap-3 text-sm">
              <Metric label="Existencia" value={item.quantity} />
              <Metric label="Reservado" value={item.reserved_quantity} />
              <Metric label="Disponible" value={item.available_quantity} />
            </div>
          </article>
        ))}
      </div>
    </section>
  )
}

export function DashboardOrdersPage() {
  const [orders, setOrders] = useState<Order[]>([])
  useEffect(() => {
    void api.orders().then(setOrders)
  }, [])
  return (
    <section className="grid gap-4">
      <h1 className="text-2xl font-800 text-slate-950">Gestion de pedidos</h1>
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
          <div className="mt-4 flex flex-wrap gap-2">
            {['ACCEPTED', 'PREPARING', 'ON_THE_WAY', 'DELIVERED', 'CANCELLED'].map((status) => (
              <button
                key={status}
                className="min-h-10 rounded-md border border-slate-300 px-3 text-xs font-800 text-slate-700"
                type="button"
                onClick={() =>
                  void api.updateOrderStatus(order.id, status).then((updated) =>
                    setOrders((current) => current.map((item) => (item.id === updated.id ? updated : item))),
                  )
                }
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

export function ImportsPage() {
  const [entity, setEntity] = useState('products')
  const [jobs, setJobs] = useState<ImportJob[]>([])
  const [result, setResult] = useState('')

  useEffect(() => {
    void api.list<ImportJob>('imports').then(setJobs)
  }, [])

  async function upload(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    if (!file) return
    const job = await api.uploadImport(entity, file)
    setJobs((current) => [job, ...current])
    setResult(`Importacion ${job.status}: ${job.processed_rows} filas procesadas, ${job.error_rows} con error.`)
  }

  return (
    <section className="grid gap-5">
      <div>
        <h1 className="text-2xl font-800 text-slate-950">Importacion CSV</h1>
        <p className="mt-2 text-sm leading-6 text-slate-600">Importa articulos, clientes, vehiculos, choferes o stock.</p>
      </div>
      <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-soft">
        <div className="grid gap-4 md:grid-cols-[220px_1fr_auto] md:items-end">
          <label className="grid gap-1 text-sm font-700 text-slate-700">
            Entidad
            <select className="min-h-11 rounded-md border border-slate-300 px-3" value={entity} onChange={(event) => setEntity(event.target.value)}>
              <option value="products">Articulos</option>
              <option value="customers">Clientes</option>
              <option value="vehicles">Vehiculos</option>
              <option value="drivers">Choferes</option>
              <option value="stock">Stock</option>
            </select>
          </label>
          <label className="grid gap-1 text-sm font-700 text-slate-700">
            Archivo CSV
            <input className="min-h-11 rounded-md border border-slate-300 px-3 py-2" type="file" accept=".csv,text/csv" onChange={(event) => void upload(event)} />
          </label>
          <a className="inline-flex min-h-11 items-center justify-center rounded-md border border-brand-200 px-4 text-sm font-800 text-brand-700" href={`${import.meta.env.VITE_API_URL ?? 'http://localhost:8000/api'}/imports/template/${entity}/`}>
            Descargar plantilla
          </a>
        </div>
        {result && <p className="mt-4 rounded-md bg-brand-50 px-3 py-2 text-sm font-800 text-brand-700">{result}</p>}
      </div>
      <div className="grid gap-3">
        {jobs.map((job) => (
          <article key={job.id} className="rounded-lg border border-slate-200 bg-white p-4 shadow-soft">
            <div className="flex flex-wrap justify-between gap-3">
              <div>
                <h2 className="font-800 text-slate-950">{job.entity_type}</h2>
                <p className="text-sm text-slate-600">
                  {job.original_filename || 'Carga CSV'} · {job.total_rows} filas
                </p>
              </div>
              <StatusBadge status={job.status} />
            </div>
            {job.error_rows > 0 && <p className="mt-2 text-sm font-700 text-red-700">{job.error_rows} filas con errores.</p>}
          </article>
        ))}
      </div>
    </section>
  )
}

export function BillingPage() {
  const [subscriptions, setSubscriptions] = useState<Array<Record<string, string | number>>>([])
  useEffect(() => {
    void api.list<Record<string, string | number>>('subscriptions').then(setSubscriptions)
  }, [])
  return (
    <section className="grid gap-4">
      <h1 className="text-2xl font-800 text-slate-950">Suscripcion</h1>
      {subscriptions.length === 0 ? (
        <EmptyState title="Sin suscripcion" text="El admin puede asignar un plan y link de Mercado Pago." />
      ) : (
        subscriptions.map((subscription) => (
          <article key={Number(subscription.id)} className="rounded-lg border border-slate-200 bg-white p-5 shadow-soft">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h2 className="text-lg font-800 text-slate-950">{String(subscription.plan_name)}</h2>
                <p className="mt-1 text-sm text-slate-600">Vencimiento: {String(subscription.expires_at ?? 'sin fecha')}</p>
              </div>
              <StatusBadge status={String(subscription.status)} />
            </div>
            {subscription.mercado_pago_link && (
              <a className="mt-4 inline-flex min-h-11 items-center rounded-md bg-brand-600 px-4 font-800 text-white" href={String(subscription.mercado_pago_link)} target="_blank" rel="noreferrer">
                Abrir Mercado Pago
              </a>
            )}
          </article>
        ))
      )}
    </section>
  )
}

export function AdminDistributorsPage() {
  const [owners, setOwners] = useState<User[]>([])

  useEffect(() => {
    void api.list<User>('users').then((users) => setOwners(users.filter((user) => user.role === 'DISTRIBUTOR')))
  }, [])

  const ownerOptions = owners.map((owner) => ({
    value: String(owner.id),
    label: `${owner.full_name} · ${owner.email}`,
  }))

  return (
    <ResourceManager
      title="Admin distribuidoras"
      description="Crea la cuenta distribuidora desde admin y asigna aqui el usuario DISTRIBUTOR que sera duenio."
      endpoint="distributors"
      fields={[
        { name: 'owner', label: 'Usuario distribuidor', type: 'select', required: true, options: ownerOptions },
        { name: 'business_name', label: 'Razon social', required: true },
        { name: 'tax_id', label: 'CUIT', required: true },
        { name: 'contact_name', label: 'Contacto', required: true },
        { name: 'email', label: 'Email', type: 'email', required: true },
        { name: 'phone', label: 'Telefono', required: true },
        { name: 'address', label: 'Direccion', required: true },
        { name: 'plan_name', label: 'Plan' },
        { name: 'mercado_pago_link', label: 'Link Mercado Pago' },
      ]}
      columns={[
        { key: 'business_name', label: 'Distribuidora' },
        { key: 'owner_email', label: 'Usuario owner' },
        { key: 'tax_id', label: 'CUIT' },
        { key: 'subscription_status', label: 'Suscripcion' },
        { key: 'active', label: 'Activa' },
      ]}
    />
  )
}

export function AdminUsersPage() {
  return (
    <ResourceManager
      title="Usuarios"
      description="Crea admins, distribuidores y clientes. Los choferes se crean desde el panel de cada distribuidora."
      endpoint="users"
      fields={[
        { name: 'email', label: 'Email', type: 'email', required: true },
        { name: 'full_name', label: 'Nombre completo', required: true },
        { name: 'phone', label: 'Telefono' },
        {
          name: 'role',
          label: 'Rol',
          type: 'select',
          required: true,
          options: [
            { value: 'ADMIN', label: 'ADMIN' },
            { value: 'DISTRIBUTOR', label: 'DISTRIBUTOR' },
            { value: 'COMMERCE', label: 'COMMERCE' },
          ],
        },
      ]}
      columns={[
        { key: 'email', label: 'Email' },
        { key: 'full_name', label: 'Nombre' },
        { key: 'role', label: 'Rol' },
        { key: 'is_active', label: 'Activo' },
      ]}
    />
  )
}

export function AdminSubscriptionsPage() {
  return (
    <section className="grid gap-8">
      <ResourceManager
        title="Planes de suscripción"
        description="Configurá los planes publicados, sus precios y la URL de Mercado Pago que usa la landing."
        endpoint="plans"
        createLabel="Agregar plan"
        allowDelete={false}
        fields={[
          {
            name: 'name',
            label: 'Plan',
            type: 'select',
            required: true,
            options: [
              { value: 'START', label: 'START' },
              { value: 'PRO', label: 'PRO' },
              { value: 'IA', label: 'IA' },
            ],
          },
          { name: 'price', label: 'Precio mensual', type: 'number', required: true },
          { name: 'description', label: 'Descripción comercial', type: 'textarea' },
          {
            name: 'mp_subscription_url',
            label: 'Link Mercado Pago',
            type: 'url',
            helperText: 'Este link se abre cuando la distribuidora elige el plan en /planes.',
          },
          { name: 'currency', label: 'Moneda', required: true },
          { name: 'sort_order', label: 'Orden', type: 'number', required: true },
          { name: 'max_products', label: 'Máximo de artículos', type: 'number', required: true },
          { name: 'max_drivers', label: 'Máximo de choferes', type: 'number', required: true },
          { name: 'is_active', label: 'Plan visible en la landing', type: 'checkbox' },
          { name: 'is_featured', label: 'Marcar como más elegido', type: 'checkbox' },
        ]}
        columns={[
          { key: 'name', label: 'Plan' },
          { key: 'price', label: 'Precio', format: (value) => money(value) },
          { key: 'mp_subscription_url', label: 'Link Mercado Pago' },
          { key: 'is_active', label: 'Visible', format: yesNo },
          { key: 'is_featured', label: 'Destacado', format: yesNo },
          { key: 'sort_order', label: 'Orden' },
        ]}
      />

      <ResourceManager
        title="Suscripciones asignadas"
        description="Asigná planes a distribuidoras y guardá el link de pago asociado a cada cuenta."
        endpoint="subscriptions"
        createLabel="Asignar suscripción"
        fields={[
          { name: 'distributor', label: 'ID distribuidora', type: 'number', required: true },
          { name: 'plan', label: 'ID plan', type: 'number', required: true },
          {
            name: 'status',
            label: 'Estado',
            type: 'select',
            required: true,
            options: [
              { value: 'TRIAL', label: 'Prueba' },
              { value: 'ACTIVE', label: 'Activa' },
              { value: 'PAST_DUE', label: 'Vencida' },
              { value: 'SUSPENDED', label: 'Suspendida' },
            ],
          },
          { name: 'mercado_pago_link', label: 'Link Mercado Pago', type: 'url' },
          { name: 'starts_at', label: 'Inicio', type: 'date' },
          { name: 'expires_at', label: 'Vencimiento', type: 'date' },
          { name: 'notes', label: 'Notas', type: 'textarea' },
        ]}
        columns={[
          { key: 'distributor_name', label: 'Distribuidora' },
          { key: 'plan_name', label: 'Plan' },
          { key: 'status', label: 'Estado' },
          { key: 'mercado_pago_link', label: 'Link Mercado Pago' },
          { key: 'expires_at', label: 'Vencimiento' },
        ]}
      />
    </section>
  )
}

function yesNo(value: unknown) {
  return value ? 'Sí' : 'No'
}

function FilterInput({
  label,
  value,
  onChange,
  type = 'text',
}: {
  label: string
  value: string
  onChange: (value: string) => void
  type?: 'text' | 'date'
}) {
  return (
    <label className="grid gap-1 font-800 text-slate-600">
      {label}
      <input
        className="min-h-9 rounded-md border border-slate-300 px-2 text-[12px] font-700 text-slate-950"
        type={type}
        value={value}
        onChange={(event) => onChange(event.target.value)}
      />
    </label>
  )
}

function Kpi({ label, value }: { label: string; value: string }) {
  return (
    <article className="rounded-lg border border-slate-200 bg-white p-3 shadow-soft">
      <p className="text-[11px] font-800 uppercase text-slate-500">{label}</p>
      <strong className="mt-1 block text-lg font-800 text-slate-950">{value}</strong>
    </article>
  )
}

function ChartPanel({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="rounded-lg border border-slate-200 bg-white p-3 shadow-soft">
      <h2 className="mb-2 text-[13px] font-800 text-slate-950">{title}</h2>
      {children}
    </section>
  )
}

function CompactTable({
  title,
  rows,
  columns,
  exportModule,
  filters,
}: {
  title: string
  rows: DashboardPoint[]
  columns: CompactColumn[]
  exportModule?: ExportModule
  filters: DashboardFilters
}) {
  return (
    <section className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-soft">
      <div className="flex items-center justify-between gap-2 border-b border-slate-200 px-3 py-2">
        <h2 className="text-[13px] font-800 text-slate-950">{title}</h2>
        {exportModule && <ExportButton module={exportModule} format="csv" label="CSV" filters={filters} compact />}
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-left text-[12px]">
          <thead className="bg-slate-100 text-[11px] font-800 uppercase text-slate-500">
            <tr>
              {columns.map(([key, label]) => (
                <th key={key} className="whitespace-nowrap px-3 py-2">
                  {label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {rows.length === 0 ? (
              <tr>
                <td className="px-3 py-4 text-slate-500" colSpan={columns.length}>
                  Sin datos
                </td>
              </tr>
            ) : (
              rows.slice(0, 8).map((row, index) => (
                <tr key={index}>
                  {columns.map(([key, , formatter]) => (
                    <td key={key} className="max-w-44 truncate px-3 py-2 font-700 text-slate-700">
                      {formatter ? formatter(row[key]) : String(row[key] ?? '')}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </section>
  )
}

function ExportButton({
  module,
  format,
  label,
  filters,
  compact = false,
}: {
  module: ExportModule
  format: 'csv' | 'xls'
  label: string
  filters: DashboardFilters
  compact?: boolean
}) {
  return (
    <button
      className={`rounded-md border border-brand-200 font-800 text-brand-700 ${compact ? 'min-h-7 px-2 text-[11px]' : 'min-h-9 px-3'}`}
      type="button"
      onClick={() => void api.downloadDashboard(module, format, filters)}
    >
      {label}
    </button>
  )
}

function Metric({ label, value, formatter = num }: { label: string; value: unknown; formatter?: (value: unknown) => string }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-3 shadow-soft">
      <p className="text-xs font-800 uppercase text-slate-500">{label}</p>
      <p className="mt-1 text-lg font-800 text-slate-950">{formatter(value)}</p>
    </div>
  )
}

function asNumber(value: unknown) {
  const parsed = Number(value ?? 0)
  return Number.isFinite(parsed) ? parsed : 0
}

function money(value: unknown) {
  return `$${asNumber(value).toLocaleString('es-AR')}`
}

function pct(value: unknown) {
  return `${asNumber(value).toLocaleString('es-AR', { maximumFractionDigits: 1 })}%`
}

function num(value: unknown) {
  return asNumber(value).toLocaleString('es-AR', { maximumFractionDigits: 1 })
}
