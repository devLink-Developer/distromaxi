import type {
  AuthResponse,
  Commerce,
  Delivery,
  Distributor,
  DistributorOnboardingState,
  DistributorPlanSelectionResponse,
  DistributorSignupResponse,
  DriverProfile,
  ImportJob,
  NotificationEvent,
  Order,
  Plan,
  Product,
  ProductCategory,
  ProductSubCategory,
  ProductSupplier,
  StockItem,
  User,
  Vehicle,
  DashboardBundle,
  DashboardFilters,
} from '../types/domain'

const API_BASE = import.meta.env.VITE_API_URL ?? '/api'

type ApiOptions = Omit<RequestInit, 'body'> & {
  body?: BodyInit | Record<string, unknown> | Array<unknown>
}

export class ApiError extends Error {
  status: number
  details: unknown

  constructor(status: number, details: unknown) {
    super(typeof details === 'string' ? details : 'No se pudo completar la solicitud')
    this.status = status
    this.details = details
  }
}

function authToken() {
  return localStorage.getItem('distromax_access')
}

export async function apiFetch<T>(path: string, options: ApiOptions = {}): Promise<T> {
  const headers = new Headers(options.headers)
  const isFormData = options.body instanceof FormData
  if (!isFormData && options.body && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json')
  }
  const token = authToken()
  if (token) headers.set('Authorization', `Bearer ${token}`)
  const requestBody: BodyInit | undefined =
    options.body instanceof FormData || typeof options.body === 'string'
      ? options.body
      : options.body
        ? JSON.stringify(options.body)
        : undefined

  const response = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers,
    body: requestBody,
  })
  if (!response.ok) {
    const details = await response.json().catch(() => response.statusText)
    throw new ApiError(response.status, details)
  }
  if (response.status === 204) return undefined as T
  return response.json() as Promise<T>
}

export const api = {
  login: (email: string, password: string) =>
    apiFetch<AuthResponse>('/auth/login', { method: 'POST', body: { email, password } }),
  register: (payload: Record<string, unknown>) =>
    apiFetch<User>('/auth/register', { method: 'POST', body: payload }),
  registerDistributor: (payload: Record<string, unknown>) =>
    apiFetch<DistributorSignupResponse>('/auth/register-distributor', { method: 'POST', body: payload }),
  me: () => apiFetch<User>('/auth/me'),
  plans: () => apiFetch<Plan[]>('/plans'),
  distributorOnboarding: () => apiFetch<DistributorOnboardingState>('/distributor-onboarding'),
  selectDistributorPlan: (planId: number) =>
    apiFetch<DistributorPlanSelectionResponse>('/distributor-onboarding/select-plan', {
      method: 'POST',
      body: { plan_id: planId },
    }),
  distributors: () => apiFetch<Distributor[]>('/distributors/'),
  distributor: (id: string | number) => apiFetch<Distributor>(`/distributors/${id}/`),
  products: (query = '') => apiFetch<Product[]>(`/products/${query}`),
  product: (id: string | number) => apiFetch<Product>(`/products/${id}/`),
  productSuppliers: () => apiFetch<ProductSupplier[]>('/product-suppliers/'),
  productCategories: () => apiFetch<ProductCategory[]>('/product-categories/'),
  productSubCategories: () => apiFetch<ProductSubCategory[]>('/product-subcategories/'),
  commerces: () => apiFetch<Commerce[]>('/commerces/'),
  stock: () => apiFetch<StockItem[]>('/stock/'),
  vehicles: () => apiFetch<Vehicle[]>('/vehicles/'),
  drivers: () => apiFetch<DriverProfile[]>('/drivers/'),
  orders: () => apiFetch<Order[]>('/orders/'),
  createOrder: (body: Record<string, unknown>) => apiFetch<Order>('/orders/', { method: 'POST', body }),
  updateOrderStatus: (id: number, status: string) =>
    apiFetch<Order>(`/orders/${id}/status/`, { method: 'PATCH', body: { status } }),
  deliveries: () => apiFetch<Delivery[]>('/deliveries/'),
  delivery: (id: string | number) => apiFetch<Delivery>(`/deliveries/${id}/`),
  updateDeliveryLocation: (id: number, body: Record<string, unknown>) =>
    apiFetch<Delivery>(`/deliveries/${id}/location/`, { method: 'PATCH', body }),
  notifications: () => apiFetch<NotificationEvent[]>('/notifications/'),
  vapidPublicKey: () => apiFetch<{ public_key: string }>('/push-subscriptions/vapid-public-key/'),
  savePushSubscription: (body: Record<string, unknown>) =>
    apiFetch('/push-subscriptions/', { method: 'POST', body }),
  sendTestPush: () => apiFetch<NotificationEvent>('/notifications/send-test/', { method: 'POST', body: {} }),
  list: <T>(endpoint: string) => apiFetch<T[]>(`/${endpoint}/`),
  create: <T>(endpoint: string, body: Record<string, unknown>) =>
    apiFetch<T>(`/${endpoint}/`, { method: 'POST', body }),
  update: <T>(endpoint: string, id: number, body: Record<string, unknown>) =>
    apiFetch<T>(`/${endpoint}/${id}/`, { method: 'PATCH', body }),
  remove: (endpoint: string, id: number) => apiFetch<void>(`/${endpoint}/${id}/`, { method: 'DELETE' }),
  uploadImport: (entityType: string, file: File) => {
    const form = new FormData()
    form.set('entity_type', entityType)
    form.set('file', file)
    return apiFetch<ImportJob>('/imports/upload/', { method: 'POST', body: form })
  },
  dashboard: (filters: DashboardFilters) => {
    const query = dashboardQuery(filters)
    return Promise.all([
      apiFetch<DashboardBundle['summary']>(`/dashboard/summary${query}`),
      apiFetch<DashboardBundle['sales']>(`/dashboard/sales${query}`),
      apiFetch<DashboardBundle['customers']>(`/dashboard/customers${query}`),
      apiFetch<DashboardBundle['products']>(`/dashboard/products${query}`),
      apiFetch<DashboardBundle['operations']>(`/dashboard/operations${query}`),
    ]).then(([summary, sales, customers, products, operations]) => ({
      summary,
      sales,
      customers,
      products,
      operations,
    }))
  },
  downloadDashboard: async (module: 'sales' | 'customers' | 'products' | 'operations', format: 'csv' | 'xls', filters: DashboardFilters) => {
    const query = dashboardQuery({ ...filters, format })
    const token = authToken()
    const response = await fetch(`${API_BASE}/dashboard/${module}${query}`, {
      headers: token ? { Authorization: `Bearer ${token}` } : undefined,
    })
    if (!response.ok) throw new ApiError(response.status, await response.text())
    const blob = await response.blob()
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `dashboard_${module}.${format}`
    link.click()
    URL.revokeObjectURL(url)
  },
}

function dashboardQuery(filters: Partial<DashboardFilters>) {
  const params = new URLSearchParams()
  Object.entries(filters).forEach(([key, value]) => {
    if (value !== undefined && value !== null && String(value) !== '') {
      params.set(key, String(value))
    }
  })
  const query = params.toString()
  return query ? `?${query}` : ''
}

export function setAuthTokens(access: string, refresh: string) {
  localStorage.setItem('distromax_access', access)
  localStorage.setItem('distromax_refresh', refresh)
}

export function clearAuthTokens() {
  localStorage.removeItem('distromax_access')
  localStorage.removeItem('distromax_refresh')
}
