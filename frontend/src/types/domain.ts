export type Role = 'ADMIN' | 'DISTRIBUTOR' | 'COMMERCE' | 'DRIVER'

export type DistributorAccessState = 'NONE' | 'ONBOARDING' | 'REVIEW_REQUIRED' | 'FAILED' | 'ACTIVE'

export type DistributorAccess = {
  state: DistributorAccessState
  onboarding_status: string | null
  onboarding_id: number | null
  distributor_id: number | null
  distributor_name: string | null
}

export type User = {
  id: number
  email: string
  full_name: string
  phone: string
  role: Role
  is_active: boolean
  distributor_access: DistributorAccess
}

export type AuthResponse = {
  access: string
  refresh: string
  user: User
}

export type Distributor = {
  id: number
  business_name: string
  tax_id: string
  contact_name: string
  email: string
  phone: string
  postal_code: string
  address: string
  city: string
  province: string
  address_notes: string
  latitude: string | null
  longitude: string | null
  currency: string
  plan_name: string
  subscription_status: string
  mercado_pago_link: string
  can_operate: boolean
  active: boolean
}

export type Plan = {
  id: number
  name: 'START' | 'PRO' | 'IA' | string
  price: string
  description: string
  currency: string
  mp_subscription_url: string
  mp_preapproval_plan_id: string
  is_active: boolean
  sort_order: number
  is_featured: boolean
  max_products?: number
  max_drivers?: number
}

export type DistributorOnboardingState = {
  access_state: DistributorAccessState
  status: string | null
  onboarding_id: number | null
  distributor_id: number | null
  business_name: string
  tax_id: string
  contact_name: string
  email: string
  phone: string
  selected_plan: Plan | null
  checkout_url: string
  review_reason: string
  failure_reason: string
  mercado_pago_status: string
  checkout_started_at: string | null
  activated_at: string | null
  created_at: string | null
  updated_at: string | null
}

export type DistributorSignupResponse = {
  user: User
  onboarding: DistributorOnboardingState
}

export type DistributorPlanSelectionResponse = {
  checkout_url: string
  onboarding: DistributorOnboardingState
}

export type Product = {
  id: number
  distributor: number
  distributor_name: string
  supplier: number | null
  supplier_name: string
  product_category: number | null
  category_name: string
  product_subcategory: number | null
  subcategory_name: string
  sku: string
  barcode: string
  name: string
  description: string
  brand: string
  category: string
  subcategory: string
  unit: string
  package_size: string
  length: string
  width: string
  height: string
  dimension_unit: string
  weight: string
  weight_unit: string
  units_per_package: number
  packages_per_pallet: number | null
  units_per_pallet: number | null
  price: string
  cost: string
  costo: string
  discount_percent: string
  porc_descuento: string
  discount_name: string
  nombre_descuento: string
  characteristics: string
  caracteristicas: string
  image_url: string
  stock_minimum: string
  stock_on_hand: string
  stock_available: string
  low_stock: boolean
  active: boolean
}

export type ProductSupplier = {
  id: number
  distributor: number
  distributor_name: string
  name: string
  contact_name: string
  phone: string
  email: string
  active: boolean
}

export type ProductCategory = {
  id: number
  distributor: number
  distributor_name: string
  name: string
  active: boolean
}

export type ProductSubCategory = {
  id: number
  distributor: number
  distributor_name: string
  category: number
  category_name: string
  name: string
  active: boolean
}

export type CartItem = {
  product: Product
  quantity: number
}

export type Commerce = {
  id: number
  distributor: number | null
  distributor_name: string
  trade_name: string
  legal_name: string
  tax_id: string
  contact_name: string
  email: string
  phone: string
  postal_code: string
  address: string
  city: string
  province: string
  latitude: string | null
  longitude: string | null
  default_window_start: string | null
  default_window_end: string | null
  delivery_notes: string
  active: boolean
}

export type StockItem = {
  id: number
  warehouse_name: string
  product_name: string
  sku: string
  quantity: string
  reserved_quantity: string
  available_quantity: string
  is_low: boolean
}

export type Vehicle = {
  id: number
  plate: string
  vehicle_type: string
  brand: string
  model: string
  year: number | null
  capacity_kg: string | null
  capacity_m3: string | null
  status: string
  active: boolean
}

export type DriverProfile = {
  id: number
  user_email: string
  full_name: string
  license_number: string
  license_category: string
  phone: string
  emergency_contact: string
  assigned_vehicle_plate: string
  available: boolean
  active: boolean
}

export type OrderItem = {
  id: number
  product: number
  product_name: string
  sku: string
  quantity: string
  price: string
  subtotal: string
  weight_kg: string
  volume_m3: string
}

export type Order = {
  id: number
  commerce: number
  commerce_name: string
  distributor: number
  distributor_name: string
  total: string
  status: string
  dispatch_date: string
  delivery_address: string
  delivery_latitude?: string | null
  delivery_longitude?: string | null
  delivery_window_start: string | null
  delivery_window_end: string | null
  notes: string
  items: OrderItem[]
  created_at: string
  updated_at?: string
}

export type DeliveryLocation = {
  id: number
  latitude: string
  longitude: string
  accuracy_m: string | null
  recorded_at: string
}

export type Delivery = {
  id: number
  order: number
  order_status: string
  commerce_name: string
  driver_name: string
  vehicle_plate: string
  status: string
  last_latitude: string | null
  last_longitude: string | null
  last_accuracy_m: string | null
  last_location_at: string | null
  locations: DeliveryLocation[]
  route_run_id: number | null
  stop_sequence: number | null
  planned_eta: string | null
}

export type RouteStop = {
  id: number
  order: number
  delivery_id: number | null
  order_status: string
  commerce_name: string
  delivery_address: string
  delivery_latitude: string | null
  delivery_longitude: string | null
  sequence: number
  status: string
  planned_eta: string
  window_start_at: string
  window_end_at: string
  leg_distance_km: string
  leg_duration_min: string
  demand_kg: string
  demand_m3: string
}

export type RouteRun = {
  id: number
  sequence: number
  status: string
  driver: number
  driver_name: string
  vehicle: number
  vehicle_plate: string
  total_stops: number
  total_distance_km: string
  total_duration_min: string
  load_kg: string
  load_m3: string
  stops: RouteStop[]
}

export type RoutePlan = {
  id: number
  distributor: number
  distributor_name: string
  dispatch_date: string
  status: string
  provider: string
  total_runs: number
  total_orders: number
  total_distance_km: string
  total_duration_min: string
  total_load_kg: string
  total_load_m3: string
  unassigned_summary: Array<{ order_id: number; reason: string }>
  can_delete: boolean
  runs: RouteRun[]
  created_at: string
  updated_at: string
}

export type CurrentRoute = {
  id: number
  route_plan_id: number
  route_plan_status: string
  sequence: number
  status: string
  driver_name: string
  vehicle_plate: string
  total_stops: number
  total_distance_km: string
  total_duration_min: string
  load_kg: string
  load_m3: string
  active_stop_id: number | null
  stops: RouteStop[]
}

export type PostalCodeLookup = {
  postal_code: string
  city: string
  province: string
  localities: string[]
}

export type GeocodedAddress = {
  address: string
  city: string
  province: string
  latitude: number
  longitude: number
}

export type NotificationEvent = {
  id: number
  kind: string
  title: string
  body: string
  read_at: string | null
  delivery_status: string
  created_at: string
}

export type ImportJob = {
  id: number
  entity_type: string
  original_filename: string
  status: string
  total_rows: number
  processed_rows: number
  error_rows: number
  errors: Array<{ row: number; error: string }>
  created_at: string
}

export type DashboardFilters = {
  date_from: string
  date_to: string
  granularity: 'day' | 'week' | 'month'
  zone: string
  format?: 'csv' | 'xls'
}

export type DashboardKpis = {
  sales_today: number
  sales_month: number
  sales_period: number
  sales_previous_period: number
  orders: number
  avg_ticket: number
  gross_margin_percent: number
  gross_margin_amount: number
  active_customers: number
  repurchase_rate: number
  low_stock_count: number
}

export type DashboardPoint = Record<string, string | number | boolean>

export type DashboardBundle = {
  summary: {
    filters: DashboardFilters
    kpis: DashboardKpis
    pipeline: Array<{ status: string; count: number }>
  }
  sales: {
    series: DashboardPoint[]
    by_category: DashboardPoint[]
    top_products: DashboardPoint[]
    bottom_products: DashboardPoint[]
    by_zone: DashboardPoint[]
  }
  customers: {
    ranking: DashboardPoint[]
    portfolio: DashboardPoint[]
    retention: Record<string, number>
  }
  products: {
    top_skus: DashboardPoint[]
    bottom_skus: DashboardPoint[]
    rotation: DashboardPoint[]
    stock_breaks: DashboardPoint[]
  }
  operations: {
    pipeline: Array<{ status: string; count: number }>
    metrics: Record<string, number>
    riders: DashboardPoint[]
  }
}
