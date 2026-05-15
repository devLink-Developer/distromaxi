import { useEffect, useMemo, useState } from 'react'
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
import { Icon } from '../components/Icon'
import { ResourceManager, type FieldConfig, type ResourceRow } from '../components/ResourceManager'
import { ServiceAreaMap, type ServiceAreaPoint } from '../components/ServiceAreaMap'
import { StatusBadge } from '../components/StatusBadge'
import { useDashboard } from '../hooks/useDashboard'
import { api } from '../services/api'
import { useFeedbackStore } from '../stores/feedbackStore'
import type {
  DashboardFilters,
  DashboardPoint,
  Distributor,
  DistributorServiceAreaMode,
  FeedbackThread,
  GeoJsonPolygon,
  ImportJob,
  Order,
  ProductCategory,
  ProductSubCategory,
  ProductSupplier,
  StockSummary,
  StockSummaryRow,
  StockUrgency,
  User,
} from '../types/domain'

type ExportModule = 'sales' | 'customers' | 'products' | 'operations'
type CompactColumn = [key: string, label: string, formatter?: (value: unknown) => string]
type SelectOption = { value: string; label: string }
type ActiveCatalogItem = { id: number; name: string; active: boolean }

const resourceManagerDensityClass = [
  'min-w-0',
  '[&>section]:gap-3',
  '[&_h1]:text-xl',
  '[&_h1]:leading-7',
  '[&_p]:text-[13px]',
  '[&_p]:leading-5',
  '[&_table]:text-[13px]',
  '[&_thead]:text-[11px]',
  '[&_th]:whitespace-nowrap',
  '[&_th]:px-3',
  '[&_th]:py-2',
  '[&_td]:max-w-[14rem]',
  '[&_td]:truncate',
  '[&_td]:px-3',
  '[&_td]:py-2',
  '[&_td]:align-top',
  '[&_article]:p-3',
].join(' ')

const productQuickFilters = [
  { id: 'active', label: 'Activos', predicate: (row: ResourceRow) => row.active !== false },
  { id: 'inactive', label: 'Inactivos', predicate: (row: ResourceRow) => row.active === false },
  { id: 'no-stock', label: 'Sin stock', predicate: (row: ResourceRow) => asNumber(row.stock_available) <= 0 },
  { id: 'low-stock', label: 'Bajo stock', predicate: (row: ResourceRow) => Boolean(row.low_stock) },
  { id: 'no-image', label: 'Sin imagen', predicate: (row: ResourceRow) => !String(row.image_url ?? '').trim() },
  { id: 'discount', label: 'Con descuento', predicate: (row: ResourceRow) => asNumber(row.discount_percent) > 0 },
]

const productFormSections = [
  {
    title: 'Identidad',
    fields: ['sku', 'name', 'brand', 'barcode', 'active'],
  },
  {
    title: 'Clasificacion',
    fields: ['supplier', 'product_category', 'product_subcategory', 'unit', 'package_size'],
  },
  {
    title: 'Comercial',
    fields: ['price', 'cost', 'discount_percent', 'discount_name', 'stock_minimum', 'stock_target', 'replenishment_multiple'],
  },
  {
    title: 'Logistica',
    fields: ['units_per_package', 'packages_per_pallet', 'units_per_pallet', 'length', 'width', 'height', 'dimension_unit', 'weight', 'weight_unit'],
  },
  {
    title: 'Contenido',
    fields: ['image_url', 'characteristics', 'description'],
  },
]

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
  const [optionsLoading, setOptionsLoading] = useState(true)

  async function refreshOptions() {
    setOptionsLoading(true)
    try {
      const [nextSuppliers, nextCategories, nextSubcategories] = await Promise.all([
        api.productSuppliers(),
        api.productCategories(),
        api.productSubCategories(),
      ])
      setSuppliers(nextSuppliers)
      setCategories(nextCategories)
      setSubcategories(nextSubcategories)
    } finally {
      setOptionsLoading(false)
    }
  }

  useEffect(() => {
    void refreshOptions()
  }, [])

  const supplierOptions = useMemo(() => activeOptions(suppliers), [suppliers])
  const categoryOptions = useMemo(() => activeOptions(categories), [categories])
  const subcategoryOptions = useMemo(() => activeSubcategoryOptions(subcategories), [subcategories])
  const productFields = useMemo(
    () => productManagerFields(supplierOptions, categoryOptions, subcategoryOptions),
    [categoryOptions, subcategoryOptions, supplierOptions],
  )
  const needsSuppliers = !optionsLoading && supplierOptions.length === 0
  const needsCategories = !optionsLoading && categoryOptions.length === 0
  const activeReferences = activeCount(suppliers) + activeCount(categories) + activeCount(subcategories)
  const totalReferences = suppliers.length + categories.length + subcategories.length

  return (
    <section className="grid gap-4 text-sm text-slate-700">
      <div className="flex flex-col gap-3 border-b border-slate-200 pb-4 xl:flex-row xl:items-end xl:justify-between">
        <div className="max-w-3xl">
          <p className="text-[11px] font-800 uppercase text-brand-700">Catalogo</p>
          <h1 className="mt-1 text-2xl font-800 text-slate-950">Productos de distribuidora</h1>
        </div>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 xl:min-w-[34rem]">
          <CatalogStat label="Proveedores" value={optionsLoading ? '...' : activeTotal(suppliers)} />
          <CatalogStat label="Categorias" value={optionsLoading ? '...' : activeTotal(categories)} />
          <CatalogStat label="Sub categorias" value={optionsLoading ? '...' : activeTotal(subcategories)} />
        </div>
      </div>

      <CatalogSetupNotice needsSuppliers={needsSuppliers} needsCategories={needsCategories} />

      <div className={resourceManagerDensityClass}>
        <ResourceManager
          title="Productos"
          endpoint="products"
          createLabel="Agregar producto"
          allowCreate={!optionsLoading && !needsSuppliers && !needsCategories}
          allowDelete={false}
          fields={productFields}
          searchPlaceholder="Buscar SKU, codigo de barras, producto, marca o proveedor"
          searchKeys={['sku', 'barcode', 'name', 'brand', 'supplier_name', 'category', 'subcategory']}
          quickFilters={productQuickFilters}
          summary={productSummary}
          mobileColumns={['name', 'sku', 'price', 'stock_available', 'active']}
          formSections={productFormSections}
          emptyTitle="Todavia no hay productos"
          columns={[
            { key: 'sku', label: 'Codigo' },
            { key: 'name', label: 'Producto' },
            { key: 'supplier_name', label: 'Proveedor' },
            { key: 'category', label: 'Categoria' },
            { key: 'price', label: 'Precio', format: money },
            { key: 'margin', label: 'Margen', format: (_value, row) => marginPct(row) },
            { key: 'stock_available', label: 'Stock', format: (_value, row) => stockLabel(row) },
            { key: 'active', label: 'Estado', format: activeStatus },
          ]}
        />
      </div>

      <section className="grid gap-3 pt-1">
        <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2 className="text-base font-800 text-slate-950">Datos auxiliares</h2>
          </div>
          <span className="w-fit rounded-md border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-800 uppercase text-slate-500">
            {optionsLoading ? 'Cargando opciones' : `${activeReferences}/${totalReferences} activas`}
          </span>
        </div>

        <div className="grid gap-3 lg:grid-cols-2 2xl:grid-cols-3">
          <div className={resourceManagerDensityClass}>
            <ResourceManager
              title="Proveedores"
              endpoint="product-suppliers"
              createLabel="Agregar proveedor"
              onSaved={refreshOptions}
              fields={[
                { name: 'name', label: 'Nombre', required: true },
                { name: 'contact_name', label: 'Contacto' },
                { name: 'phone', label: 'Telefono' },
                { name: 'email', label: 'Email', type: 'email' },
                { name: 'lead_time_days', label: 'Plazo reposicion dias', type: 'number', defaultValue: 0, min: 0, step: 1 },
                { name: 'active', label: 'Activo', type: 'checkbox', defaultValue: true },
              ]}
              columns={[
                { key: 'name', label: 'Proveedor' },
                { key: 'contact_name', label: 'Contacto' },
                { key: 'lead_time_days', label: 'Lead time', format: (value) => `${num(value)} dias` },
                { key: 'active', label: 'Activo', format: yesNo },
              ]}
            />
          </div>
          <div className={resourceManagerDensityClass}>
            <ResourceManager
              title="Categorias"
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
          </div>
          <div className={`${resourceManagerDensityClass} lg:col-span-2 2xl:col-span-1`}>
            <ResourceManager
              title="Sub categorias"
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
        </div>
      </section>
    </section>
  )
}

function activeOptions<T extends ActiveCatalogItem>(items: T[]): SelectOption[] {
  return [...items]
    .filter((item) => item.active)
    .sort((left, right) => left.name.localeCompare(right.name, 'es'))
    .map((item) => ({ value: String(item.id), label: item.name }))
}

function activeSubcategoryOptions(items: ProductSubCategory[]): SelectOption[] {
  return [...items]
    .filter((item) => item.active)
    .sort((left, right) => `${left.category_name} ${left.name}`.localeCompare(`${right.category_name} ${right.name}`, 'es'))
    .map((item) => ({ value: String(item.id), label: `${item.category_name} / ${item.name}` }))
}

function activeCount(items: Array<{ active: boolean }>) {
  return items.filter((item) => item.active).length
}

function activeTotal(items: Array<{ active: boolean }>) {
  return `${activeCount(items)}/${items.length}`
}

function CatalogStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0 rounded-lg border border-slate-200 bg-white p-3 shadow-soft">
      <p className="truncate text-[11px] font-800 uppercase text-slate-500">{label}</p>
      <p className="mt-1 text-lg font-800 text-slate-950">{value}</p>
    </div>
  )
}

function CatalogSetupNotice({
  needsSuppliers,
  needsCategories,
}: {
  needsSuppliers: boolean
  needsCategories: boolean
}) {
  if (!needsSuppliers && !needsCategories) return null

  return (
    <div className="flex flex-col gap-1 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-[13px] leading-5 text-amber-900 sm:flex-row sm:items-center sm:justify-between">
      <p className="font-800">
        {needsSuppliers && needsCategories
          ? 'Faltan proveedores y categorias.'
          : needsSuppliers
            ? 'Faltan proveedores.'
            : 'Faltan categorias.'}
      </p>
    </div>
  )
}

function productSummary(rows: ResourceRow[]): Array<{
  label: string
  value: string | number
  hint: string
  tone: 'success' | 'warning' | 'danger'
}> {
  const activeRows = rows.filter((row) => row.active !== false)
  const noStock = activeRows.filter((row) => asNumber(row.stock_available) <= 0).length
  const lowStock = activeRows.filter((row) => Boolean(row.low_stock)).length
  const missingImage = activeRows.filter((row) => !String(row.image_url ?? '').trim()).length
  const negativeMargin = activeRows.filter((row) => asNumber(row.price) > 0 && asNumber(row.cost) > asNumber(row.price)).length

  return [
    { label: 'SKUs activos', value: `${activeRows.length}/${rows.length}`, hint: 'Visibles para venta', tone: activeRows.length ? 'success' : 'warning' },
    { label: 'Sin stock', value: noStock, hint: 'Revisar antes de vender', tone: noStock ? 'danger' : 'success' },
    { label: 'Bajo minimo', value: lowStock, hint: 'Reposicion sugerida', tone: lowStock ? 'warning' : 'success' },
    { label: 'Sin imagen', value: missingImage, hint: 'Mejora conversion', tone: missingImage ? 'warning' : 'success' },
    { label: 'Margen negativo', value: negativeMargin, hint: 'Costo mayor al precio', tone: negativeMargin ? 'danger' : 'success' },
  ]
}

function marginPct(row: ResourceRow) {
  const price = asNumber(row.price)
  const cost = asNumber(row.cost ?? row.costo)
  if (price <= 0) return '-'
  return pct(((price - cost) / price) * 100)
}

function stockLabel(row: ResourceRow) {
  const available = asNumber(row.stock_available)
  const unit = String(row.unit ?? '').trim()
  const amount = unit ? `${num(available)} ${unit}` : num(available)
  if (available <= 0) return 'Sin stock'
  if (row.low_stock) return `Bajo: ${amount}`
  return amount
}

function activeStatus(value: unknown) {
  return value === false ? 'Inactivo' : 'Activo'
}

function productManagerFields(
  supplierOptions: SelectOption[],
  categoryOptions: SelectOption[],
  subcategoryOptions: SelectOption[],
): FieldConfig[] {
  return [
    { name: 'sku', label: 'Codigo', required: true, placeholder: 'SKU-0001' },
    { name: 'name', label: 'Nombre', required: true, placeholder: 'Producto, medida y presentacion' },
    { name: 'brand', label: 'Marca' },
    { name: 'barcode', label: 'Codigo de barras' },
    { name: 'active', label: 'Activo para venta', type: 'checkbox', defaultValue: true },
    {
      name: 'supplier',
      label: 'Proveedor',
      type: 'select',
      required: true,
      options: supplierOptions,
    },
    {
      name: 'product_category',
      label: 'Categoria',
      type: 'select',
      required: true,
      options: categoryOptions,
    },
    { name: 'product_subcategory', label: 'Sub categoria', type: 'select', options: subcategoryOptions },
    { name: 'unit', label: 'Unidad de medida', required: true },
    { name: 'package_size', label: 'Presentacion' },
    { name: 'price', label: 'Precio', type: 'number', required: true, min: 0, step: 0.01 },
    { name: 'cost', label: 'Costo', type: 'number', min: 0, step: 0.01 },
    { name: 'discount_percent', label: 'Porc. descuento', type: 'number', defaultValue: 0, min: 0, max: 100, step: 0.01 },
    { name: 'discount_name', label: 'Nombre descuento' },
    { name: 'stock_minimum', label: 'Stock minimo', type: 'number', min: 0, step: 0.001 },
    { name: 'stock_target', label: 'Stock objetivo', type: 'number', min: 0, step: 0.001 },
    { name: 'replenishment_multiple', label: 'Lote minimo compra', type: 'number', min: 0, step: 0.001 },
    { name: 'units_per_package', label: 'Unidades por bulto', type: 'number', required: true, defaultValue: 1, min: 1, step: 1 },
    { name: 'packages_per_pallet', label: 'Bultos por pallet', type: 'number', min: 0, step: 1 },
    { name: 'units_per_pallet', label: 'Unidades por pallet', type: 'number', min: 0, step: 1 },
    { name: 'length', label: 'Largo', type: 'number', required: true, min: 0, step: 0.001 },
    { name: 'width', label: 'Ancho', type: 'number', required: true, min: 0, step: 0.001 },
    { name: 'height', label: 'Alto', type: 'number', required: true, min: 0, step: 0.001 },
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
    { name: 'weight', label: 'Peso', type: 'number', required: true, min: 0, step: 0.001 },
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
    { name: 'image_url', label: 'URL de imagen', type: 'url' },
    { name: 'characteristics', label: 'Caracteristicas', type: 'textarea', span: 'full' },
    { name: 'description', label: 'Descripcion', type: 'textarea', span: 'full' },
  ]
}

export function CustomersManagerPage() {
  return (
    <ResourceManager
      title="Clientes"
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

export function DeliverySlotsManagerPage() {
  return (
    <ResourceManager
      title="Franjas de entrega"
      endpoint="delivery-slots"
      createLabel="Agregar franja"
      fields={[
        { name: 'name', label: 'Nombre', required: true, placeholder: 'Manana, Tarde, 08 a 12' },
        { name: 'start_time', label: 'Desde', type: 'time', required: true },
        { name: 'end_time', label: 'Hasta', type: 'time', required: true },
        { name: 'sort_order', label: 'Orden', type: 'number', defaultValue: 0, required: true },
        { name: 'active', label: 'Franja activa', type: 'checkbox', defaultValue: true },
      ]}
      columns={[
        { key: 'name', label: 'Franja' },
        { key: 'start_time', label: 'Desde', format: (value) => formatTimeValue(value) },
        { key: 'end_time', label: 'Hasta', format: (value) => formatTimeValue(value) },
        { key: 'active', label: 'Activa', format: yesNo },
        { key: 'sort_order', label: 'Orden' },
      ]}
      searchKeys={['name', 'start_time', 'end_time']}
      summary={(rows) => {
        const active = rows.filter((row) => row.active !== false).length
        return [
          { label: 'Franjas activas', value: active },
          { label: 'Total configuradas', value: rows.length },
        ]
      }}
      emptyTitle="Todavia no hay franjas"
    />
  )
}

export function VehiclesManagerPage() {
  return (
    <ResourceManager
      title="Vehiculos"
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
  const [summary, setSummary] = useState<StockSummary | null>(null)
  const [suggestions, setSuggestions] = useState<StockSummaryRow[]>([])
  const [suppliers, setSuppliers] = useState<ProductSupplier[]>([])
  const [days, setDays] = useState('30')
  const [query, setQuery] = useState('')
  const [urgency, setUrgency] = useState<'all' | StockUrgency>('all')
  const [supplier, setSupplier] = useState('all')
  const [warehouse, setWarehouse] = useState('all')
  const [loading, setLoading] = useState(true)
  const [countingItem, setCountingItem] = useState<StockSummaryRow | null>(null)
  const [countedQuantity, setCountedQuantity] = useState('')
  const [countNote, setCountNote] = useState('')
  const [savingCount, setSavingCount] = useState(false)
  const showError = useFeedbackStore((state) => state.error)
  const showSuccess = useFeedbackStore((state) => state.success)

  async function loadStock(nextDays = days) {
    setLoading(true)
    try {
      const rangeDays = Number(nextDays) || 30
      const [nextSummary, nextSuggestions, nextSuppliers] = await Promise.all([
        api.stockSummary(rangeDays),
        api.stockReplenishment(rangeDays),
        api.productSuppliers(),
      ])
      setSummary(nextSummary)
      setSuggestions(nextSuggestions)
      setSuppliers(nextSuppliers)
    } catch (error) {
      showError(error instanceof Error ? error.message : 'No se pudo cargar el stock inteligente')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void loadStock(days)
  }, [days])

  const rows = summary?.rows ?? []
  const filteredRows = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase()
    return rows.filter((row) => {
      const matchesQuery =
        !normalizedQuery ||
        [row.product_name, row.sku, row.supplier_name, row.category_name, row.warehouse_name]
          .join(' ')
          .toLowerCase()
          .includes(normalizedQuery)
      const matchesUrgency = urgency === 'all' || row.urgency === urgency
      const matchesSupplier = supplier === 'all' || String(row.supplier ?? '') === supplier
      const matchesWarehouse = warehouse === 'all' || String(row.warehouse) === warehouse
      return matchesQuery && matchesUrgency && matchesSupplier && matchesWarehouse
    })
  }, [query, rows, supplier, urgency, warehouse])

  const supplierOptions = useMemo(() => {
    const options = new Map<string, string>()
    suppliers.forEach((item) => {
      if (item.active !== false) options.set(String(item.id), item.name)
    })
    rows.forEach((row) => {
      if (row.supplier) options.set(String(row.supplier), row.supplier_name)
    })
    return [...options.entries()].sort((left, right) => left[1].localeCompare(right[1], 'es'))
  }, [rows, suppliers])

  const warehouseOptions = useMemo(() => {
    const options = new Map<string, string>()
    rows.forEach((row) => options.set(String(row.warehouse), row.warehouse_name))
    return [...options.entries()].sort((left, right) => left[1].localeCompare(right[1], 'es'))
  }, [rows])

  const filteredSuggestions = useMemo(() => {
    const stockIds = new Set(filteredRows.map((row) => row.stock_item_id))
    return suggestions.filter((row) => stockIds.has(row.stock_item_id)).slice(0, 8)
  }, [filteredRows, suggestions])

  const filteredTotals = useMemo(() => {
    return filteredRows.reduce(
      (acc, row) => ({
        available: acc.available + asNumber(row.available_quantity),
        reserved: acc.reserved + asNumber(row.reserved_quantity),
        suggested: acc.suggested + asNumber(row.recommended_qty),
      }),
      { available: 0, reserved: 0, suggested: 0 },
    )
  }, [filteredRows])

  function openCycleCount(row: StockSummaryRow) {
    setCountingItem(row)
    setCountedQuantity(String(row.quantity))
    setCountNote('')
  }

  async function submitCycleCount(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!countingItem) return
    setSavingCount(true)
    try {
      await api.cycleCountStock(countingItem.stock_item_id, {
        counted_quantity: countedQuantity,
        note: countNote.trim(),
      })
      setCountingItem(null)
      showSuccess('Conteo fisico registrado y stock ajustado.')
      await loadStock(days)
    } catch (error) {
      showError(error instanceof Error ? error.message : 'No se pudo registrar el conteo')
    } finally {
      setSavingCount(false)
    }
  }

  return (
    <section className="grid gap-4 text-sm text-slate-700">
      <div className="flex flex-col gap-3 border-b border-slate-200 pb-4 xl:flex-row xl:items-end xl:justify-between">
        <div className="max-w-3xl">
          <p className="text-[11px] font-800 uppercase text-brand-700">Inventario</p>
          <h1 className="mt-1 text-2xl font-800 text-slate-950">Stock inteligente</h1>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            className="min-h-10 rounded-md border border-slate-300 px-3 text-xs font-800 text-slate-700 disabled:opacity-60"
            disabled={loading}
            type="button"
            onClick={() => void loadStock(days)}
          >
            Actualizar
          </button>
        </div>
      </div>

      <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-6">
        <StockKpi label="SKUs controlados" value={num(summary?.kpis.total_skus)} hint={`${filteredRows.length} visibles`} />
        <StockKpi label="Sin stock" value={num(summary?.kpis.out_of_stock)} hint="Sin disponible para venta" tone="danger" />
        <StockKpi label="Criticos y bajos" value={num(summary?.kpis.low_stock)} hint="Requieren revision" tone="warning" />
        <StockKpi label="Unidades reservadas" value={num(summary?.kpis.reserved_units)} hint="Comprometidas en pedidos" />
        <StockKpi label="SKUs a reponer" value={num(summary?.kpis.suggested_skus)} hint={`${num(summary?.kpis.suggested_units)} unidades`} tone="warning" />
        <StockKpi label="Reposicion filtrada" value={num(filteredTotals.suggested)} hint={`${num(filteredTotals.available)} disp. / ${num(filteredTotals.reserved)} res.`} />
      </div>

      <div className="grid gap-2 rounded-lg border border-slate-200 bg-white p-3 shadow-soft md:grid-cols-2 xl:grid-cols-[1.4fr_0.8fr_0.8fr_0.8fr_0.6fr]">
        <label className="grid gap-1 text-[12px] font-800 text-slate-600">
          Buscar SKU o producto
          <span className="relative">
            <Icon name="search" className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              className="min-h-10 w-full rounded-md border border-slate-300 pl-9 pr-3 text-[13px] font-700 text-slate-950"
              placeholder="Producto, proveedor, categoria"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
            />
          </span>
        </label>
        <StockSelect label="Urgencia" value={urgency} onChange={(value) => setUrgency(value as 'all' | StockUrgency)}>
          <option value="all">Todas</option>
          {stockUrgencyOptions.map((option) => (
            <option key={option} value={option}>
              {stockUrgencyLabels[option]}
            </option>
          ))}
        </StockSelect>
        <StockSelect label="Proveedor" value={supplier} onChange={setSupplier}>
          <option value="all">Todos</option>
          {supplierOptions.map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </StockSelect>
        <StockSelect label="Deposito" value={warehouse} onChange={setWarehouse}>
          <option value="all">Todos</option>
          {warehouseOptions.map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </StockSelect>
        <StockSelect label="Ventas" value={days} onChange={setDays}>
          <option value="7">7 dias</option>
          <option value="15">15 dias</option>
          <option value="30">30 dias</option>
          <option value="60">60 dias</option>
          <option value="90">90 dias</option>
        </StockSelect>
      </div>

      <section className="grid gap-3 xl:grid-cols-[0.95fr_1.55fr]">
        <div className="rounded-lg border border-slate-200 bg-white shadow-soft">
          <div className="border-b border-slate-200 px-4 py-3">
            <h2 className="text-base font-800 text-slate-950">Reposicion sugerida</h2>
          </div>
          <div className="grid gap-2 p-3">
            {loading && !summary ? (
              <p className="p-3 text-[13px] font-800 text-slate-500">Cargando sugerencias...</p>
            ) : filteredSuggestions.length === 0 ? (
              <EmptyState title="Sin sugerencias" />
            ) : (
              filteredSuggestions.map((row) => (
                <article key={row.stock_item_id} className="rounded-lg border border-slate-200 p-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-[11px] font-800 uppercase text-brand-700">{row.sku}</p>
                      <h3 className="truncate text-[13px] font-800 text-slate-950">{row.product_name}</h3>
                      <p className="mt-1 truncate text-[12px] text-slate-500">{row.supplier_name || 'Sin proveedor'}</p>
                    </div>
                    <StockUrgencyBadge urgency={row.urgency} />
                  </div>
                  <div className="mt-3 grid grid-cols-3 gap-2 text-[12px]">
                    <StockTinyMetric label="Comprar" value={num(row.recommended_qty)} strong />
                    <StockTinyMetric label="Disponible" value={num(row.available_quantity)} />
                    <StockTinyMetric label="Cobertura" value={coverageLabel(row)} />
                  </div>
                </article>
              ))
            )}
          </div>
        </div>

        <div className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-soft">
          <div className="flex flex-col gap-1 border-b border-slate-200 px-4 py-3 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h2 className="text-base font-800 text-slate-950">Inventario por SKU y deposito</h2>
            </div>
            <span className="w-fit rounded-md bg-slate-100 px-2.5 py-1 text-[11px] font-800 uppercase text-slate-600">
              {filteredRows.length}/{rows.length} filas
            </span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[920px] text-left text-[12px]">
              <thead className="bg-slate-100 text-[11px] font-800 uppercase text-slate-500">
                <tr>
                  <th className="px-3 py-2">Producto</th>
                  <th className="px-3 py-2">Deposito</th>
                  <th className="px-3 py-2 text-right">Disponible</th>
                  <th className="px-3 py-2 text-right">Reservado</th>
                  <th className="px-3 py-2 text-right">Total</th>
                  <th className="px-3 py-2 text-right">Cobertura</th>
                  <th className="px-3 py-2 text-right">Comprar</th>
                  <th className="px-3 py-2">Alerta</th>
                  <th className="px-3 py-2 text-right">Conteo</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {loading && !summary ? (
                  <tr>
                    <td className="px-3 py-5 font-800 text-slate-500" colSpan={9}>
                      Cargando stock...
                    </td>
                  </tr>
                ) : filteredRows.length === 0 ? (
                  <tr>
                    <td className="px-3 py-5 text-slate-500" colSpan={9}>
                      No hay stock para los filtros aplicados.
                    </td>
                  </tr>
                ) : (
                  filteredRows.map((row) => (
                    <tr key={row.stock_item_id}>
                      <td className="max-w-[18rem] px-3 py-3">
                        <p className="truncate font-800 text-slate-950">{row.product_name}</p>
                        <p className="mt-0.5 truncate text-[11px] font-800 uppercase text-slate-500">
                          {row.sku} {row.supplier_name ? `- ${row.supplier_name}` : ''}
                        </p>
                      </td>
                      <td className="px-3 py-3 font-700 text-slate-700">{row.warehouse_name}</td>
                      <td className="px-3 py-3 text-right font-800 text-slate-950">{num(row.available_quantity)}</td>
                      <td className="px-3 py-3 text-right font-700 text-slate-700">{num(row.reserved_quantity)}</td>
                      <td className="px-3 py-3 text-right font-700 text-slate-700">{num(row.quantity)}</td>
                      <td className="px-3 py-3 text-right font-700 text-slate-700">{coverageLabel(row)}</td>
                      <td className="px-3 py-3 text-right font-800 text-brand-700">{num(row.recommended_qty)}</td>
                      <td className="px-3 py-3">
                        <StockUrgencyBadge urgency={row.urgency} />
                      </td>
                      <td className="px-3 py-3 text-right">
                        <button
                          className="min-h-8 rounded-md border border-slate-300 px-2.5 text-[11px] font-800 text-slate-700 transition hover:bg-slate-50"
                          type="button"
                          onClick={() => openCycleCount(row)}
                        >
                          Contar
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {countingItem && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/40 p-4">
          <form
            aria-labelledby="cycle-count-title"
            className="w-full max-w-lg rounded-lg bg-white p-5 shadow-2xl"
            role="dialog"
            onSubmit={(event) => void submitCycleCount(event)}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-[11px] font-800 uppercase text-brand-700">{countingItem.sku}</p>
                <h2 id="cycle-count-title" className="mt-1 truncate text-lg font-800 text-slate-950">
                  Conteo fisico
                </h2>
                <p className="mt-1 text-sm leading-5 text-slate-600">{countingItem.product_name}</p>
              </div>
              <button
                aria-label="Cerrar conteo fisico"
                className="grid h-9 w-9 place-items-center rounded-md border border-slate-300 text-slate-600"
                type="button"
                onClick={() => setCountingItem(null)}
              >
                <Icon name="close" className="h-4 w-4" />
              </button>
            </div>

            <div className="mt-4 grid gap-2 rounded-lg border border-slate-200 bg-slate-50 p-3 sm:grid-cols-3">
              <StockTinyMetric label="Sistema" value={num(countingItem.quantity)} />
              <StockTinyMetric label="Reservado" value={num(countingItem.reserved_quantity)} />
              <StockTinyMetric label="Disponible" value={num(countingItem.available_quantity)} />
            </div>

            <div className="mt-4 grid gap-3">
              <label className="grid gap-1 text-sm font-800 text-slate-700">
                Cantidad fisica
                <input
                  autoFocus
                  className="min-h-11 rounded-md border border-slate-300 px-3 text-slate-950"
                  min="0"
                  required
                  step="0.001"
                  type="number"
                  value={countedQuantity}
                  onChange={(event) => setCountedQuantity(event.target.value)}
                />
              </label>
              <label className="grid gap-1 text-sm font-800 text-slate-700">
                Motivo
                <textarea
                  className="min-h-24 rounded-md border border-slate-300 px-3 py-2 text-slate-950"
                  placeholder="Diferencia por conteo, rotura, vencimiento u otro motivo"
                  value={countNote}
                  onChange={(event) => setCountNote(event.target.value)}
                />
              </label>
              <p className="rounded-md bg-slate-100 px-3 py-2 text-[13px] font-800 text-slate-700">
                Diferencia: {signedNum(asNumber(countedQuantity) - asNumber(countingItem.quantity))}
              </p>
            </div>

            <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <button
                className="min-h-10 rounded-md border border-slate-300 px-4 text-sm font-800 text-slate-700"
                type="button"
                onClick={() => setCountingItem(null)}
              >
                Cancelar
              </button>
              <button
                className="min-h-10 rounded-md bg-brand-600 px-4 text-sm font-800 text-white transition hover:bg-brand-700 disabled:opacity-60"
                disabled={savingCount}
                type="submit"
              >
                {savingCount ? 'Guardando...' : 'Guardar ajuste'}
              </button>
            </div>
          </form>
        </div>
      )}
    </section>
  )
}

const stockUrgencyOptions: StockUrgency[] = ['out_of_stock', 'critical', 'warning', 'low', 'ok']

const stockUrgencyLabels: Record<StockUrgency, string> = {
  out_of_stock: 'Sin stock',
  critical: 'Critico',
  warning: 'Cobertura corta',
  low: 'Bajo objetivo',
  ok: 'Normal',
}

const stockUrgencyClasses: Record<StockUrgency, string> = {
  out_of_stock: 'bg-red-50 text-red-700 ring-red-500/20',
  critical: 'bg-rose-50 text-rose-700 ring-rose-500/20',
  warning: 'bg-amber-50 text-amber-800 ring-amber-500/20',
  low: 'bg-brand-50 text-brand-700 ring-brand-500/20',
  ok: 'bg-mint-50 text-mint-700 ring-mint-500/20',
}

function StockKpi({
  label,
  value,
  hint,
  tone = 'neutral',
}: {
  label: string
  value: string
  hint: string
  tone?: 'neutral' | 'warning' | 'danger'
}) {
  const toneClass =
    tone === 'danger'
      ? 'border-red-200 bg-red-50'
      : tone === 'warning'
        ? 'border-amber-200 bg-amber-50'
        : 'border-slate-200 bg-white'
  return (
    <article className={`rounded-lg border p-3 shadow-soft ${toneClass}`}>
      <p className="truncate text-[11px] font-800 uppercase text-slate-500">{label}</p>
      <strong className="mt-1 block text-lg font-800 text-slate-950">{value}</strong>
      <p className="mt-1 truncate text-[12px] font-700 text-slate-600">{hint}</p>
    </article>
  )
}

function StockSelect({
  label,
  value,
  onChange,
  children,
}: {
  label: string
  value: string
  onChange: (value: string) => void
  children: ReactNode
}) {
  return (
    <label className="grid gap-1 text-[12px] font-800 text-slate-600">
      {label}
      <select
        className="min-h-10 rounded-md border border-slate-300 px-2 text-[13px] font-700 text-slate-950"
        value={value}
        onChange={(event) => onChange(event.target.value)}
      >
        {children}
      </select>
    </label>
  )
}

function StockUrgencyBadge({ urgency }: { urgency: StockUrgency }) {
  return (
    <span className={`inline-flex min-h-7 items-center rounded-md px-2.5 text-[11px] font-800 ring-1 ${stockUrgencyClasses[urgency]}`}>
      {stockUrgencyLabels[urgency]}
    </span>
  )
}

function StockTinyMetric({
  label,
  value,
  strong = false,
}: {
  label: string
  value: string
  strong?: boolean
}) {
  return (
    <div className="min-w-0 rounded-md bg-slate-50 px-2 py-2">
      <p className="truncate text-[10px] font-800 uppercase text-slate-500">{label}</p>
      <p className={`mt-1 truncate text-[12px] ${strong ? 'font-800 text-brand-700' : 'font-700 text-slate-800'}`}>{value}</p>
    </div>
  )
}

function coverageLabel(row: StockSummaryRow) {
  if (row.coverage_days === null) return 'Sin ventas'
  return `${num(row.coverage_days)} dias`
}

function signedNum(value: unknown) {
  const parsed = asNumber(value)
  return `${parsed > 0 ? '+' : ''}${num(parsed)}`
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
        <EmptyState title="Todavia no tenes un plan activo" />
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
      <EmptyState title="No pudimos cargar la distribuidora" />
    ) : (
      <EmptyState title="Todavia no hay una distribuidora asociada" />
    )
  }

  return (
    <section className="grid gap-5">
      <div>
        <p className="text-sm font-800 uppercase text-brand-700">Direccion principal</p>
        <h1 className="mt-2 text-2xl font-800 text-slate-950">Perfil de la distribuidora</h1>
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

export function DistributorScopePage() {
  const [profile, setProfile] = useState<Distributor | null>(null)
  const [mode, setMode] = useState<DistributorServiceAreaMode>('NONE')
  const [points, setPoints] = useState<ServiceAreaPoint[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [fullscreen, setFullscreen] = useState(false)
  const [loadFailed, setLoadFailed] = useState(false)
  const showSuccess = useFeedbackStore((state) => state.success)
  const showError = useFeedbackStore((state) => state.error)

  useEffect(() => {
    void api
      .distributors()
      .then((rows) => {
        const current = rows[0] ?? null
        setProfile(current)
        setMode(current?.service_area_mode ?? 'NONE')
        setPoints(polygonToServiceAreaPoints(current?.service_area_polygon ?? null))
        setLoadFailed(false)
      })
      .catch(() => {
        setLoadFailed(true)
        showError('No pudimos cargar el alcance de la distribuidora.')
      })
      .finally(() => setLoading(false))
  }, [showError])

  useEffect(() => {
    if (!fullscreen) return

    const previousOverflow = document.body.style.overflow
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setFullscreen(false)
    }

    document.body.style.overflow = 'hidden'
    window.addEventListener('keydown', handleEscape)

    return () => {
      document.body.style.overflow = previousOverflow
      window.removeEventListener('keydown', handleEscape)
    }
  }, [fullscreen])

  async function saveScope() {
    if (!profile) return
    if (mode === 'POLYGON' && points.length < 3) {
      showError('Dibuja al menos 3 puntos para guardar el poligono.')
      return
    }

    setSaving(true)
    try {
      const updated = await api.update<Distributor>('distributors', profile.id, serviceAreaPayload(mode, points))
      setProfile(updated)
      setMode(updated.service_area_mode)
      setPoints(polygonToServiceAreaPoints(updated.service_area_polygon))
      showSuccess('Alcance actualizado.')
    } catch (caught) {
      showError(caught instanceof Error ? caught.message : 'No se pudo guardar el alcance.')
    } finally {
      setSaving(false)
    }
  }

  function addPoint(point: ServiceAreaPoint) {
    setPoints((current) => [...current, point])
  }

  function movePoint(index: number, point: ServiceAreaPoint) {
    setPoints((current) => current.map((item, itemIndex) => (itemIndex === index ? point : item)))
  }

  if (loading) {
    return <div className="rounded-lg border border-slate-200 bg-white p-6 text-sm font-700 text-slate-600">Cargando alcance...</div>
  }

  if (!profile) {
    return loadFailed ? (
      <EmptyState title="No pudimos cargar el alcance" />
    ) : (
      <EmptyState title="Todavia no hay una distribuidora asociada" />
    )
  }

  const polygonIsValid = points.length >= 3
  const saveDisabled = saving || (mode === 'POLYGON' && !polygonIsValid)

  return (
    <section className="grid gap-5">
      <div className="grid gap-2">
        <p className="text-sm font-800 uppercase tracking-[0.14em] text-brand-700">Configuracion comercial</p>
        <h1 className="text-2xl font-800 text-slate-950">Alcance de venta</h1>
      </div>

      <div className="grid gap-4 rounded-lg border border-slate-200 bg-white p-5 shadow-soft">
        <div className="grid gap-3 md:grid-cols-3">
          <ScopeModeButton
            active={mode === 'NONE'}
            title="Sin alcance"
            onClick={() => setMode('NONE')}
          />
          <ScopeModeButton
            active={mode === 'COUNTRY'}
            title="Todo Argentina"
            onClick={() => setMode('COUNTRY')}
          />
          <ScopeModeButton
            active={mode === 'POLYGON'}
            title="Poligono"
            onClick={() => setMode('POLYGON')}
          />
        </div>

        <div className="rounded-md border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-800 text-slate-700">
          {serviceAreaModeLabel(mode)}
        </div>
      </div>

      {mode === 'POLYGON' ? (
        <div className="grid gap-4 overflow-hidden rounded-lg border border-slate-200 bg-white shadow-soft">
          <div className="flex flex-col gap-3 border-b border-slate-200 px-5 py-4 md:flex-row md:items-center md:justify-between">
            <div>
              <h2 className="text-lg font-800 text-slate-950">Mapa de alcance</h2>
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                className="inline-flex min-h-10 items-center gap-2 rounded-md border border-slate-200 bg-white px-3 text-sm font-800 text-slate-700 transition hover:border-brand-500 hover:text-brand-700"
                type="button"
                onClick={() => setFullscreen(true)}
              >
                <Icon name="map" className="h-4 w-4" />
                Pantalla completa
              </button>
              <button
                className="min-h-10 rounded-md border border-slate-200 bg-white px-3 text-sm font-800 text-slate-700 transition hover:border-slate-300 disabled:opacity-50"
                type="button"
                disabled={points.length === 0}
                onClick={() => setPoints((current) => current.slice(0, -1))}
              >
                Deshacer
              </button>
              <button
                className="min-h-10 rounded-md border border-slate-200 bg-white px-3 text-sm font-800 text-slate-700 transition hover:border-slate-300 disabled:opacity-50"
                type="button"
                disabled={points.length === 0}
                onClick={() => setPoints([])}
              >
                Limpiar
              </button>
            </div>
          </div>

          <div className="grid gap-4 p-4 lg:grid-cols-[minmax(0,1fr)_17rem]">
            <ServiceAreaMap points={points} disabled={saving} onAddPoint={addPoint} onMovePoint={movePoint} />
            <aside className="grid content-start gap-3 rounded-md border border-slate-200 bg-slate-50 p-4">
              <div>
                <p className="text-sm font-800 text-slate-950">{points.length} vertices</p>
              </div>
              <div className="grid max-h-72 gap-2 overflow-y-auto pr-1">
                {points.length === 0 ? (
                  <p className="text-sm text-slate-500">Sin vertices.</p>
                ) : (
                  points.map((point, index) => (
                    <div key={`${index}-${point.latitude}-${point.longitude}`} className="rounded-md border border-slate-200 bg-white px-3 py-2 text-xs font-700 text-slate-600">
                      #{index + 1} {formatCoordinate(point.latitude)}, {formatCoordinate(point.longitude)}
                    </div>
                  ))
                )}
              </div>
            </aside>
          </div>
        </div>
      ) : null}

      <div className="flex flex-col gap-3 rounded-lg border border-slate-200 bg-white p-4 shadow-soft sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm font-800 text-slate-700">{currentScopeSummary(profile)}</p>
        <button
          className="min-h-11 rounded-full bg-brand-600 px-5 text-sm font-800 text-white transition hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-60"
          type="button"
          disabled={saveDisabled}
          onClick={() => void saveScope()}
        >
          {saving ? 'Guardando...' : 'Guardar alcance'}
        </button>
      </div>

      {fullscreen ? (
        <div className="fixed inset-0 z-[1200] grid bg-slate-950/80 p-3 backdrop-blur-sm md:p-6" role="dialog" aria-modal="true" aria-label="Mapa de alcance en pantalla completa">
          <div className="grid min-h-0 overflow-hidden rounded-lg bg-white shadow-2xl">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 px-4 py-3">
              <div>
                <p className="text-sm font-800 text-slate-950">Mapa de alcance</p>
                <p className="text-sm text-slate-600">{points.length} vertices seleccionados</p>
              </div>
              <div className="flex flex-wrap gap-2">
                <button
                  className="min-h-10 rounded-md border border-slate-200 bg-white px-3 text-sm font-800 text-slate-700 transition hover:border-slate-300 disabled:opacity-50"
                  type="button"
                  disabled={points.length === 0}
                  onClick={() => setPoints((current) => current.slice(0, -1))}
                >
                  Deshacer
                </button>
                <button
                  className="min-h-10 rounded-md border border-slate-200 bg-white px-3 text-sm font-800 text-slate-700 transition hover:border-slate-300 disabled:opacity-50"
                  type="button"
                  disabled={points.length === 0}
                  onClick={() => setPoints([])}
                >
                  Limpiar
                </button>
                <button
                  className="inline-flex min-h-10 items-center justify-center gap-2 rounded-md bg-slate-950 px-4 text-sm font-800 text-white transition hover:bg-slate-800"
                  type="button"
                  onClick={() => setFullscreen(false)}
                >
                  <Icon name="close" className="h-4 w-4" />
                  Cerrar
                </button>
              </div>
            </div>
            <div className="min-h-0 p-3">
              <ServiceAreaMap points={points} disabled={saving} fullscreen onAddPoint={addPoint} onMovePoint={movePoint} />
            </div>
          </div>
        </div>
      ) : null}
    </section>
  )
}

function ScopeModeButton({
  active,
  title,
  onClick,
}: {
  active: boolean
  title: string
  onClick: () => void
}) {
  return (
    <button
      className={`grid min-h-16 rounded-md border p-4 text-left transition ${
        active ? 'border-brand-500 bg-brand-50 text-brand-950' : 'border-slate-200 bg-white text-slate-700 hover:border-brand-300'
      }`}
      type="button"
      aria-pressed={active}
      onClick={onClick}
    >
      <span className="text-base font-800">{title}</span>
    </button>
  )
}

function serviceAreaPayload(mode: DistributorServiceAreaMode, points: ServiceAreaPoint[]) {
  if (mode === 'COUNTRY') {
    return { service_area_mode: 'COUNTRY', service_area_country: 'AR' }
  }
  if (mode === 'POLYGON') {
    return { service_area_mode: 'POLYGON', service_area_polygon: serviceAreaPointsToPolygon(points) }
  }
  return { service_area_mode: 'NONE' }
}

function polygonToServiceAreaPoints(polygon: GeoJsonPolygon | null): ServiceAreaPoint[] {
  const ring = polygon?.coordinates?.[0] ?? []
  const openRing = ring.length > 1 && coordinatesMatch(ring[0], ring[ring.length - 1]) ? ring.slice(0, -1) : ring
  return openRing
    .map(([longitude, latitude]) => ({ latitude, longitude }))
    .filter((point) => Number.isFinite(point.latitude) && Number.isFinite(point.longitude))
}

function serviceAreaPointsToPolygon(points: ServiceAreaPoint[]): GeoJsonPolygon {
  const ring = points.map((point) => [roundCoordinate(point.longitude), roundCoordinate(point.latitude)])
  if (ring.length > 0) ring.push([...ring[0]])
  return { type: 'Polygon', coordinates: [ring] }
}

function coordinatesMatch(first: number[], second: number[]) {
  return first.length >= 2 && second.length >= 2 && first[0] === second[0] && first[1] === second[1]
}

function roundCoordinate(value: number) {
  return Number(value.toFixed(7))
}

function formatCoordinate(value: number) {
  return value.toFixed(5)
}

function serviceAreaModeLabel(mode: DistributorServiceAreaMode) {
  if (mode === 'COUNTRY') return 'Todo Argentina'
  if (mode === 'POLYGON') return 'Poligono'
  return 'Sin alcance'
}

function currentScopeSummary(profile: Distributor) {
  if (profile.service_area_mode === 'COUNTRY') return 'Alcance actual: Argentina.'
  if (profile.service_area_mode === 'POLYGON') {
    return `Alcance actual: ${polygonToServiceAreaPoints(profile.service_area_polygon).length} vertices.`
  }
  return 'Alcance actual: sin alcance.'
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
        description="Edita el plan unico que se muestra a las distribuidoras, su prueba gratis, el precio y el enlace de pago."
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
              { value: 'MaxiGestion', label: 'MaxiGestion' },
            ],
          },
          { name: 'price', label: 'Precio mensual', type: 'number', required: true },
          { name: 'description', label: 'Descripcion', type: 'textarea' },
          { name: 'trial_days', label: 'Dias de prueba', type: 'number', required: true },
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
          { name: 'is_featured', label: 'Destacar oferta', type: 'checkbox' },
        ]}
        columns={[
          { key: 'name', label: 'Plan' },
          { key: 'price', label: 'Precio', format: (value) => money(value) },
          { key: 'trial_days', label: 'Prueba' },
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

export function AdminFeedbackPage() {
  const [threads, setThreads] = useState<FeedbackThread[]>([])
  const [selectedId, setSelectedId] = useState<number | null>(null)
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const showError = useFeedbackStore((state) => state.error)
  const showSuccess = useFeedbackStore((state) => state.success)
  const selectedThread = useMemo(() => threads.find((thread) => thread.id === selectedId) ?? threads[0] ?? null, [selectedId, threads])

  async function load(nextSelectedId?: number) {
    setLoading(true)
    try {
      const data = await api.feedbackThreads()
      setThreads(data)
      if (nextSelectedId) setSelectedId(nextSelectedId)
      else if (!selectedId && data[0]) setSelectedId(data[0].id)
    } catch (caught) {
      showError(caught instanceof Error ? caught.message : 'No pudimos cargar las opiniones.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void load()
  }, [])

  async function submitReply(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!selectedThread || submitting) return
    const form = new FormData(event.currentTarget)
    const body = String(form.get('reply') ?? '').trim()
    if (!body) return
    setSubmitting(true)
    try {
      await api.replyFeedbackThread(selectedThread.id, { body })
      event.currentTarget.reset()
      await load(selectedThread.id)
      showSuccess('Respuesta enviada.')
    } catch (caught) {
      showError(caught instanceof Error ? caught.message : 'No pudimos enviar la respuesta.')
    } finally {
      setSubmitting(false)
    }
  }

  async function closeThread() {
    if (!selectedThread || submitting) return
    setSubmitting(true)
    try {
      await api.updateFeedbackThread(selectedThread.id, { status: 'CLOSED' })
      await load(selectedThread.id)
      showSuccess('Hilo cerrado.')
    } catch (caught) {
      showError(caught instanceof Error ? caught.message : 'No pudimos cerrar el hilo.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <section className="grid gap-5">
      <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-soft">
        <p className="text-sm font-800 uppercase text-brand-700">Opiniones</p>
        <h1 className="mt-1 text-2xl font-800 text-slate-950">Conversaciones con usuarios</h1>
        <p className="mt-2 text-sm leading-6 text-slate-600">Lee opiniones de compradores y distribuidoras, responde y cierra hilos cuando queden resueltos.</p>
      </div>

      <div className="grid gap-5 lg:grid-cols-[24rem_1fr]">
        <aside className="grid gap-3 rounded-lg border border-slate-200 bg-white p-3 shadow-soft">
          {loading ? <p className="p-3 text-sm font-800 text-slate-500">Cargando opiniones...</p> : null}
          {!loading && threads.length === 0 ? <EmptyState title="No hay opiniones" text="Cuando un usuario escriba desde el boton flotante, aparece aca." /> : null}
          {threads.map((thread) => (
            <button
              key={thread.id}
              className={`rounded-md border p-3 text-left transition ${selectedThread?.id === thread.id ? 'border-brand-400 bg-brand-50' : 'border-slate-200 hover:bg-slate-50'}`}
              type="button"
              onClick={() => setSelectedId(thread.id)}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-800 text-slate-950">{thread.subject}</p>
                  <p className="mt-1 text-xs font-800 uppercase text-slate-500">{thread.created_by_role === 'DISTRIBUTOR' ? 'Distribuidora' : 'Comprador'}</p>
                </div>
                <span className={`rounded-md px-2 py-1 text-[11px] font-800 uppercase ${feedbackStatusClass(thread.status)}`}>{feedbackStatusLabel(thread.status)}</span>
              </div>
              <p className="mt-2 text-xs leading-5 text-slate-500">{thread.created_by_name} - {thread.created_by_email}</p>
            </button>
          ))}
        </aside>

        <section className="min-h-[34rem] rounded-lg border border-slate-200 bg-white p-5 shadow-soft">
          {selectedThread ? (
            <div className="grid min-h-full content-between gap-5">
              <div>
                <div className="flex flex-col gap-3 border-b border-slate-200 pb-4 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <p className="text-xs font-800 uppercase text-brand-700">{feedbackCategoryLabel(selectedThread.category)}</p>
                    <h2 className="mt-1 text-xl font-800 text-slate-950">{selectedThread.subject}</h2>
                    <p className="mt-1 text-sm leading-6 text-slate-600">{selectedThread.created_by_name} - {selectedThread.created_by_email}</p>
                  </div>
                  {selectedThread.status !== 'CLOSED' && (
                    <button className="min-h-11 rounded-md border border-slate-300 px-4 text-sm font-800 text-slate-700 transition hover:bg-slate-50 disabled:opacity-60" type="button" disabled={submitting} onClick={() => void closeThread()}>
                      Cerrar hilo
                    </button>
                  )}
                </div>

                <div className="mt-5 grid gap-3">
                  {selectedThread.messages.map((message) => (
                    <article key={message.id} className={`max-w-[42rem] rounded-lg border p-4 ${message.is_staff_reply ? 'justify-self-end border-brand-200 bg-brand-50' : 'justify-self-start border-slate-200 bg-slate-50'}`}>
                      <p className="text-xs font-800 uppercase text-slate-500">{message.is_staff_reply ? 'Admin DistroMaxi' : message.author_name}</p>
                      <p className="mt-2 whitespace-pre-line text-sm leading-6 text-slate-800">{message.body}</p>
                    </article>
                  ))}
                </div>
              </div>

              {selectedThread.status !== 'CLOSED' ? (
                <form className="grid gap-3 border-t border-slate-200 pt-4" onSubmit={submitReply}>
                  <label className="grid gap-1 text-sm font-800 text-slate-700">
                    Respuesta
                    <textarea className="min-h-28 rounded-md border border-slate-300 px-3 py-2 text-base sm:text-sm" name="reply" required />
                  </label>
                  <button className="min-h-11 w-fit rounded-md bg-brand-600 px-4 text-sm font-800 text-white transition hover:bg-brand-700 disabled:opacity-60" type="submit" disabled={submitting}>
                    {submitting ? 'Enviando...' : 'Responder'}
                  </button>
                </form>
              ) : (
                <p className="rounded-md border border-slate-200 bg-slate-50 p-3 text-sm font-800 text-slate-600">Hilo cerrado.</p>
              )}
            </div>
          ) : (
            <div className="grid min-h-[24rem] place-items-center text-center">
              <p className="text-sm font-800 text-slate-500">Selecciona una opinion para responder.</p>
            </div>
          )}
        </section>
      </div>
    </section>
  )
}

function yesNo(value: unknown) {
  return value ? 'Si' : 'No'
}

function formatTimeValue(value: unknown) {
  const text = String(value ?? '')
  return text ? text.slice(0, 5) : '-'
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

function feedbackStatusLabel(status: FeedbackThread['status']) {
  if (status === 'ANSWERED') return 'Respondido'
  if (status === 'CLOSED') return 'Cerrado'
  return 'Abierto'
}

function feedbackStatusClass(status: FeedbackThread['status']) {
  if (status === 'ANSWERED') return 'bg-emerald-50 text-emerald-700'
  if (status === 'CLOSED') return 'bg-slate-100 text-slate-600'
  return 'bg-amber-50 text-amber-700'
}

function feedbackCategoryLabel(category: FeedbackThread['category']) {
  if (category === 'ISSUE') return 'Problema'
  if (category === 'QUESTION') return 'Consulta'
  if (category === 'OTHER') return 'Otro'
  return 'Sugerencia'
}

function pct(value: unknown) {
  return `${asNumber(value).toLocaleString('es-AR', { maximumFractionDigits: 1 })}%`
}

function num(value: unknown) {
  return asNumber(value).toLocaleString('es-AR', { maximumFractionDigits: 1 })
}
