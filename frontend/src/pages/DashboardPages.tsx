import { useEffect, useState } from 'react'
import type { ChangeEvent, FormEvent, ReactNode } from 'react'
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

import { AddressEditor } from '../components/AddressEditor'
import { EmptyState } from '../components/EmptyState'
import { ResourceManager } from '../components/ResourceManager'
import { StatusBadge } from '../components/StatusBadge'
import { useDashboard } from '../hooks/useDashboard'
import { api } from '../services/api'
import { useFeedbackStore } from '../stores/feedbackStore'
import type {
  DashboardFilters,
  DashboardPoint,
  Distributor,
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
  const showError = useFeedbackStore((state) => state.error)

  useEffect(() => {
    if (error) showError(error)
  }, [error, showError])

  return (
    <section className="grid gap-3 text-[12px] leading-5 text-slate-700">
      <div className="flex flex-col gap-2 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-[11px] font-800 uppercase text-brand-700">Resumen</p>
          <h1 className="mt-1 text-2xl font-800 text-slate-950">Panel de tu distribuidora</h1>
        </div>
        <div className="flex flex-wrap gap-2">
          <button className="min-h-9 rounded-md border border-slate-300 px-3 font-800 text-slate-700" type="button" onClick={() => void refresh()}>
            Actualizar
          </button>
          <ExportButton module="sales" format="csv" label="Descargar ventas" filters={filters} />
          <ExportButton module="products" format="xls" label="Descargar productos" filters={filters} />
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
      {loading && !data && <p className="rounded-lg border border-slate-200 bg-white p-4 font-800 text-slate-600">Cargando resumen...</p>}

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
          title="Clientes que mas compran"
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
          title="Productos mas vendidos"
          rows={data?.products.top_skus ?? []}
          columns={[
            ['sku', 'Codigo'],
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
          title="Faltantes y cobertura"
          rows={data?.products.stock_breaks ?? []}
          columns={[
            ['sku', 'Codigo'],
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
            ['name', 'Chofer'],
            ['deliveries', 'Entregas', num],
            ['delivered', 'OK', num],
          ]}
          exportModule="operations"
          filters={filters}
        />
        <CompactTable
          title="Productos con menos movimiento"
          rows={data?.sales.bottom_products ?? []}
          columns={[
            ['sku', 'Codigo'],
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
        title="Productos"
        description="Administra tu catalogo de venta, la presentacion y los datos del producto."
        endpoint="products"
        fields={[
          { name: 'sku', label: 'Codigo', required: true },
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
          { key: 'sku', label: 'Codigo' },
          { key: 'name', label: 'Producto' },
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
        { name: 'postal_code', label: 'Codigo postal' },
        { name: 'address', label: 'Direccion', required: true },
        { name: 'city', label: 'Ciudad' },
        { name: 'province', label: 'Provincia' },
        { name: 'latitude', label: 'Latitud', type: 'number' },
        { name: 'longitude', label: 'Longitud', type: 'number' },
        { name: 'default_window_start', label: 'Franja desde', type: 'time' },
        { name: 'default_window_end', label: 'Franja hasta', type: 'time' },
        { name: 'delivery_notes', label: 'Notas de entrega', type: 'textarea' },
      ]}
      columns={[
        { key: 'trade_name', label: 'Comercio' },
        { key: 'tax_id', label: 'CUIT' },
        { key: 'phone', label: 'Telefono' },
        { key: 'postal_code', label: 'CP' },
        { key: 'address', label: 'Direccion' },
        { key: 'default_window_start', label: 'Desde' },
        { key: 'default_window_end', label: 'Hasta' },
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
        { name: 'capacity_m3', label: 'Capacidad m3', type: 'number' },
        { name: 'insurance_expires_at', label: 'Vence seguro', type: 'date' },
        { name: 'inspection_expires_at', label: 'Vence VTV', type: 'date' },
      ]}
      columns={[
        { key: 'plate', label: 'Patente' },
        { key: 'vehicle_type', label: 'Tipo' },
        { key: 'brand', label: 'Marca' },
        { key: 'capacity_m3', label: 'm3' },
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
  const showSuccess = useFeedbackStore((state) => state.success)
  const showError = useFeedbackStore((state) => state.error)

  useEffect(() => {
    void api.list<ImportJob>('imports').then(setJobs)
  }, [])

  async function upload(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    if (!file) return
    try {
      const job = await api.uploadImport(entity, file)
      setJobs((current) => [job, ...current])
      showSuccess(`Carga ${job.status}: ${job.processed_rows} registros procesados y ${job.error_rows} con error.`)
    } catch (caught) {
      showError(caught instanceof Error ? caught.message : 'No se pudo cargar el archivo.')
    } finally {
      event.target.value = ''
    }
  }

  return (
    <section className="grid gap-5">
      <div>
        <h1 className="text-2xl font-800 text-slate-950">Carga de archivos</h1>
        <p className="mt-2 text-sm leading-6 text-slate-600">Subi un archivo para actualizar productos, clientes, vehiculos, choferes o stock.</p>
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
            Archivo
            <input className="min-h-11 rounded-md border border-slate-300 px-3 py-2" type="file" accept=".csv,text/csv" onChange={(event) => void upload(event)} />
          </label>
          <a className="inline-flex min-h-11 items-center justify-center rounded-md border border-brand-200 px-4 text-sm font-800 text-brand-700" href={`${import.meta.env.VITE_API_URL ?? 'http://localhost:8000/api'}/imports/template/${entity}/`}>
            Descargar plantilla
          </a>
        </div>
      </div>
      <div className="grid gap-3">
        {jobs.map((job) => (
          <article key={job.id} className="rounded-lg border border-slate-200 bg-white p-4 shadow-soft">
            <div className="flex flex-wrap justify-between gap-3">
              <div>
                <h2 className="font-800 text-slate-950">{job.entity_type}</h2>
                <p className="text-sm text-slate-600">
                  {job.original_filename || 'Archivo cargado'} · {job.total_rows} registros
                </p>
              </div>
              <StatusBadge status={job.status} />
            </div>
            {job.error_rows > 0 && <p className="mt-2 text-sm font-700 text-red-700">{job.error_rows} registros con errores.</p>}
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
      <h1 className="text-2xl font-800 text-slate-950">Tu plan</h1>
      {subscriptions.length === 0 ? (
        <EmptyState title="Todavia no tenes un plan activo" text="Cuando tengas un plan asignado, lo vas a ver aca." />
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
                Ver pago
              </a>
            )}
          </article>
        ))
      )}
    </section>
  )
}

export function DistributorProfilePage() {
  const [profile, setProfile] = useState<Distributor | null>(null)
  const [loading, setLoading] = useState(true)
  const [savingContact, setSavingContact] = useState(false)
  const [savingAddress, setSavingAddress] = useState(false)
  const [loadFailed, setLoadFailed] = useState(false)
  const showSuccess = useFeedbackStore((state) => state.success)
  const showError = useFeedbackStore((state) => state.error)

  useEffect(() => {
    void api
      .distributors()
      .then((rows) => {
        setProfile(rows[0] ?? null)
        setLoadFailed(false)
      })
      .catch(() => {
        setLoadFailed(true)
        showError('No pudimos cargar los datos de la distribuidora.')
      })
      .finally(() => setLoading(false))
  }, [showError])

  async function submitContact(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!profile) return
    setSavingContact(true)
    const form = new FormData(event.currentTarget)
    try {
      const updated = await api.update<Distributor>('distributors', profile.id, {
        contact_name: form.get('contact_name'),
        email: form.get('email'),
        phone: form.get('phone'),
      })
      setProfile(updated)
      showSuccess('Datos operativos actualizados.')
    } catch (caught) {
      showError(caught instanceof Error ? caught.message : 'No se pudo guardar el perfil.')
    } finally {
      setSavingContact(false)
    }
  }

  async function saveAddress(value: {
    postal_code: string
    address: string
    city: string
    province: string
    latitude: string | null
    longitude: string | null
    notes: string
  }) {
    if (!profile) return
    setSavingAddress(true)
    try {
      const updated = await api.update<Distributor>('distributors', profile.id, {
        postal_code: value.postal_code,
        address: value.address,
        city: value.city,
        province: value.province,
        address_notes: value.notes,
        latitude: value.latitude,
        longitude: value.longitude,
      })
      setProfile(updated)
      showSuccess('Direccion principal actualizada.')
    } catch (caught) {
      showError(caught instanceof Error ? caught.message : 'No se pudo guardar la direccion.')
    } finally {
      setSavingAddress(false)
    }
  }

  if (loading) {
    return <div className="rounded-lg border border-slate-200 bg-white p-6 text-sm font-700 text-slate-600">Cargando perfil...</div>
  }

  if (!profile) {
    return loadFailed ? (
      <EmptyState title="No pudimos cargar la distribuidora" text="Intenta de nuevo en unos segundos." />
    ) : (
      <EmptyState title="Todavia no hay una distribuidora asociada" text="Cuando la cuenta quede lista, vas a ver aca los datos de tu distribuidora." />
    )
  }

  return (
    <section className="grid gap-5">
      <div>
        <p className="text-sm font-800 uppercase text-brand-700">Direccion principal</p>
        <h1 className="mt-2 text-2xl font-800 text-slate-950">Perfil de la distribuidora</h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">Primero mantienes los datos operativos y despues gestionas la direccion principal con el mismo flujo guiado de alta o edicion.</p>
      </div>

      <form className="grid gap-4 rounded-[1.75rem] border border-slate-200 bg-white p-6 shadow-soft" onSubmit={(event) => void submitContact(event)}>
        <div className="grid gap-4 md:grid-cols-2">
          <label className="grid gap-1 text-sm font-700 text-slate-700">
            Razon social
            <input className="min-h-11 rounded-md border border-slate-300 px-3 text-slate-500" defaultValue={profile.business_name} disabled />
          </label>
          <label className="grid gap-1 text-sm font-700 text-slate-700">
            CUIT
            <input className="min-h-11 rounded-md border border-slate-300 px-3 text-slate-500" defaultValue={profile.tax_id} disabled />
          </label>
          <label className="grid gap-1 text-sm font-700 text-slate-700">
            Contacto principal
            <input className="min-h-11 rounded-md border border-slate-300 px-3" name="contact_name" defaultValue={profile.contact_name} required />
          </label>
          <label className="grid gap-1 text-sm font-700 text-slate-700">
            Telefono
            <input className="min-h-11 rounded-md border border-slate-300 px-3" name="phone" type="tel" defaultValue={profile.phone} required />
          </label>
          <label className="grid gap-1 text-sm font-700 text-slate-700 md:col-span-2">
            Email operativo
            <input className="min-h-11 rounded-md border border-slate-300 px-3" name="email" type="email" defaultValue={profile.email} required />
          </label>
        </div>
        <div className="flex justify-end">
          <button className="min-h-11 rounded-full bg-brand-600 px-5 text-sm font-800 text-white transition hover:bg-brand-700 disabled:opacity-60" disabled={savingContact} type="submit">
            {savingContact ? 'Guardando...' : 'Guardar datos operativos'}
          </button>
        </div>
      </form>

      <AddressEditor
        title={profile.address ? 'Editar direccion principal' : 'Cargar direccion principal'}
        description="La base operativa de la distribuidora define el origen del ruteo. Por eso pedimos codigo postal, localidad valida y geolocalizacion confirmada."
        notesLabel="Indicaciones adicionales"
        saveLabel="Guardar direccion principal"
        initialValue={{
          postal_code: profile.postal_code ?? '',
          address: profile.address ?? '',
          city: profile.city ?? '',
          province: profile.province ?? '',
          latitude: profile.latitude,
          longitude: profile.longitude,
          notes: profile.address_notes ?? '',
        }}
        saving={savingAddress}
        error=""
        message=""
        onSave={saveAddress}
      />
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
      title="Distribuidoras"
      description="Crea una distribuidora y elegi la cuenta que la va a administrar."
      endpoint="distributors"
      fields={[
        { name: 'owner', label: 'Cuenta responsable', type: 'select', required: true, options: ownerOptions },
        { name: 'business_name', label: 'Razon social', required: true },
        { name: 'tax_id', label: 'CUIT', required: true },
        { name: 'contact_name', label: 'Contacto', required: true },
        { name: 'email', label: 'Email', type: 'email', required: true },
        { name: 'phone', label: 'Telefono', required: true },
        { name: 'postal_code', label: 'Codigo postal' },
        { name: 'address', label: 'Direccion principal' },
        { name: 'city', label: 'Ciudad' },
        { name: 'province', label: 'Provincia' },
        { name: 'address_notes', label: 'Indicaciones', type: 'textarea' },
        { name: 'plan_name', label: 'Plan' },
        { name: 'mercado_pago_link', label: 'Enlace de pago' },
      ]}
      columns={[
        { key: 'business_name', label: 'Distribuidora' },
        { key: 'owner_email', label: 'Cuenta responsable' },
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
      description="Crea cuentas para el equipo y para clientes. Los choferes se cargan desde cada distribuidora."
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
            { value: 'ADMIN', label: 'Administrador' },
            { value: 'DISTRIBUTOR', label: 'Distribuidora' },
            { value: 'COMMERCE', label: 'Cliente' },
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
        title="Planes"
        description="Edita los planes que se muestran a las distribuidoras, el precio y el enlace de pago."
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
          { name: 'description', label: 'Descripcion', type: 'textarea' },
          {
            name: 'mp_subscription_url',
            label: 'Enlace de pago',
            type: 'url',
            helperText: 'Es el enlace que se abre cuando una distribuidora elige este plan.',
          },
          {
            name: 'mp_preapproval_plan_id',
            label: 'Codigo del plan de cobro',
            helperText: 'Sirve para vincular correctamente el plan con el pago.',
          },
          { name: 'currency', label: 'Moneda', required: true },
          { name: 'sort_order', label: 'Orden', type: 'number', required: true },
          { name: 'max_products', label: 'Maximo de productos', type: 'number', required: true },
          { name: 'max_drivers', label: 'Maximo de choferes', type: 'number', required: true },
          { name: 'is_active', label: 'Plan visible en la landing', type: 'checkbox' },
          { name: 'is_featured', label: 'Marcar como mas elegido', type: 'checkbox' },
        ]}
        columns={[
          { key: 'name', label: 'Plan' },
          { key: 'price', label: 'Precio', format: (value) => money(value) },
          { key: 'mp_subscription_url', label: 'Enlace de pago' },
          { key: 'mp_preapproval_plan_id', label: 'Codigo del plan' },
          { key: 'is_active', label: 'Visible', format: yesNo },
          { key: 'is_featured', label: 'Destacado', format: yesNo },
          { key: 'sort_order', label: 'Orden' },
        ]}
      />

      <ResourceManager
        title="Planes asignados"
        description="Asigna un plan a una distribuidora y guarda el enlace de pago si hace falta."
        endpoint="subscriptions"
        createLabel="Asignar plan"
        fields={[
          { name: 'distributor', label: 'Distribuidora', type: 'number', required: true },
          { name: 'plan', label: 'Plan', type: 'number', required: true },
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
          { name: 'mercado_pago_link', label: 'Enlace de pago', type: 'url' },
          { name: 'starts_at', label: 'Inicio', type: 'date' },
          { name: 'expires_at', label: 'Vencimiento', type: 'date' },
          { name: 'notes', label: 'Notas', type: 'textarea' },
        ]}
        columns={[
          { key: 'distributor_name', label: 'Distribuidora' },
          { key: 'plan_name', label: 'Plan' },
          { key: 'status', label: 'Estado' },
          { key: 'mercado_pago_link', label: 'Enlace de pago' },
          { key: 'expires_at', label: 'Vencimiento' },
        ]}
      />
    </section>
  )
}

function yesNo(value: unknown) {
  return value ? 'Si' : 'No'
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
        {exportModule && <ExportButton module={exportModule} format="csv" label="Descargar" filters={filters} compact />}
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
