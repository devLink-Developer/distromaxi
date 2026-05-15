import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { ReactNode } from 'react'

import { App } from '../../app/App'
import { FeedbackLayer } from '../../components/FeedbackLayer'
import { useAuthStore } from '../../stores/authStore'
import { useCartStore } from '../../stores/cartStore'
import { useFeedbackStore } from '../../stores/feedbackStore'
import type { Product } from '../../types/domain'
import { LoginPage, RegisterPage } from '../AuthPages'
import { CartPage, CheckoutPage, DistributorCatalogPage, HomePage } from '../CommercePages'
import { AdminSubscriptionsPage, StockPage } from '../DashboardPages'
import { DriverDeliveriesPage } from '../DriverPages'
import { DistributorRegisterPage } from '../DistributorOnboardingPages'
import { PlansPage } from '../PlansPage'
import { DashboardOrdersRoutingPage, DashboardRoutingPage } from '../RoutingPages'

const inactiveDistributorAccess = {
  state: 'NONE' as const,
  onboarding_status: null,
  onboarding_id: null,
  distributor_id: null,
  distributor_name: null,
  plan_name: null,
  routing_enabled: false,
  manual_routing_enabled: false,
  automatic_routing_enabled: false,
}

const pendingDistributorAccess = {
  state: 'ONBOARDING' as const,
  onboarding_status: 'CHECKOUT_PENDING',
  onboarding_id: 7,
  distributor_id: null,
  distributor_name: null,
  plan_name: 'Pro',
  routing_enabled: false,
  manual_routing_enabled: false,
  automatic_routing_enabled: false,
}

const activeDistributorAccess = {
  state: 'ACTIVE' as const,
  onboarding_status: 'ACTIVE',
  onboarding_id: 7,
  distributor_id: 3,
  distributor_name: 'Distribuidora Andina',
  plan_name: 'Pro',
  routing_enabled: true,
  manual_routing_enabled: true,
  automatic_routing_enabled: true,
}

const product: Product = {
  id: 1,
  distributor: 1,
  distributor_name: 'Distribuidora Andina',
  supplier: null,
  supplier_name: '',
  product_category: null,
  category_name: 'Bebidas',
  product_subcategory: null,
  subcategory_name: '',
  sku: 'SKU-1',
  barcode: '779',
  name: 'Agua mineral 1.5L x 6',
  description: 'Pack mayorista',
  brand: 'Andina',
  category: 'Bebidas',
  subcategory: '',
  unit: 'bulto',
  package_size: '6',
  length: '40.000',
  width: '30.000',
  height: '25.000',
  dimension_unit: 'cm',
  weight: '8.000',
  weight_unit: 'kg',
  units_per_package: 6,
  packages_per_pallet: 60,
  units_per_pallet: 360,
  price: '3250.00',
  cost: '2340.00',
  costo: '2340.00',
  discount_percent: '0.00',
  porc_descuento: '0.00',
  discount_name: '',
  nombre_descuento: '',
  characteristics: '',
  caracteristicas: '',
  image_url: '',
  stock_minimum: '10.000',
  stock_target: '30.000',
  replenishment_multiple: '6.000',
  stock_on_hand: '120.000',
  stock_available: '120.000',
  low_stock: false,
  active: true,
}

const otherProduct: Product = {
  ...product,
  id: 2,
  distributor: 2,
  distributor_name: 'Distribuidora Sur',
  sku: 'SKU-2',
  name: 'Yerba mate 1kg x 10',
}

const distributor = {
  id: 1,
  business_name: 'Distribuidora Andina',
  tax_id: '30-1',
  contact_name: 'Ventas',
  email: 'ventas@andina.local',
  phone: '111',
  postal_code: '1414',
  address: 'Av. San Martin 2450',
  city: 'Buenos Aires',
  province: 'CABA',
  address_notes: '',
  latitude: '-34.6037220',
  longitude: '-58.3815920',
  currency: 'ARS',
  plan_name: 'Mayorista',
  subscription_status: 'ACTIVE',
  mercado_pago_link: '',
  can_operate: true,
  active: true,
}

const routePlan = {
  id: 11,
  distributor: 1,
  distributor_name: 'Distribuidora Andina',
  dispatch_date: '2026-04-22',
  status: 'DRAFT',
  provider: 'ors',
  total_runs: 1,
  total_orders: 1,
  total_distance_km: '12.000',
  total_duration_min: '40.00',
  total_load_kg: '8.000',
  total_load_m3: '0.300000',
  unassigned_summary: [],
  can_delete: true,
  runs: [
    {
      id: 21,
      sequence: 1,
      status: 'CONFIRMED',
      driver: 3,
      driver_name: 'Marta Chofer',
      vehicle: 4,
      vehicle_plate: 'AB123CD',
      total_stops: 1,
      total_distance_km: '12.000',
      total_duration_min: '40.00',
      load_kg: '8.000',
      load_m3: '0.300000',
      stops: [
        {
          id: 31,
          order: 10,
          delivery_id: 91,
          order_status: 'SCHEDULED',
          commerce_name: 'Almacen Luna',
          delivery_address: 'Humboldt 1400',
          delivery_latitude: '-34.5841000',
          delivery_longitude: '-58.4351000',
          sequence: 1,
          status: 'PENDING',
          planned_eta: '2026-04-22T10:00:00.000Z',
          window_start_at: '2026-04-22T08:00:00.000Z',
          window_end_at: '2026-04-22T14:00:00.000Z',
          leg_distance_km: '12.000',
          leg_duration_min: '20.00',
          demand_kg: '8.000',
          demand_m3: '0.300000',
        },
      ],
    },
  ],
  created_at: '2026-04-21T10:00:00.000Z',
  updated_at: '2026-04-21T10:00:00.000Z',
}

const currentRoute = {
  id: 21,
  route_plan_id: 11,
  route_plan_status: 'DISPATCHED',
  sequence: 1,
  status: 'DISPATCHED',
  driver_name: 'Marta Chofer',
  vehicle_plate: 'AB123CD',
  total_stops: 1,
  total_distance_km: '12.000',
  total_duration_min: '40.00',
  load_kg: '8.000',
  load_m3: '0.300000',
  active_stop_id: 31,
  stops: routePlan.runs[0].stops,
}

const customerSummaryOrder = {
  id: 10,
  commerce: 1,
  commerce_name: 'Almacen Luna',
  distributor: 1,
  distributor_name: 'Distribuidora Andina',
  total: '3250.00',
  status: 'PENDING',
  dispatch_date: '2026-04-22',
  delivery_slot: null,
  delivery_slot_name: null,
  delivery_slot_start_time: null,
  delivery_slot_end_time: null,
  delivery_address: 'Humboldt 1400, CABA',
  delivery_latitude: '-34.5841000',
  delivery_longitude: '-58.4351000',
  delivery_window_start: '08:00:00',
  delivery_window_end: '14:00:00',
  notes: '',
  items: [],
  created_at: '2026-04-21T10:00:00.000Z',
  updated_at: '2026-04-21T10:00:00.000Z',
}

const customerSummaryCommerce = {
  id: 1,
  distributor: 1,
  distributor_name: 'Distribuidora Andina',
  trade_name: 'Almacen Luna',
  legal_name: 'Almacen Luna SRL',
  tax_id: '30-12345678-9',
  contact_name: 'Clara Luna',
  email: 'compras@luna.local',
  phone: '1111-2222',
  postal_code: '1414',
  address: 'Humboldt 1400',
  city: 'CABA',
  province: 'Buenos Aires',
  latitude: '-34.5841000',
  longitude: '-58.4351000',
  default_window_start: '08:00:00',
  default_window_end: '14:00:00',
  delivery_notes: 'Recibe por puerta lateral.',
  active: true,
}

function pendingRouteOrder(id: number, commerceName: string, plannedWeightKg: string, plannedVolumeM3: string) {
  return {
    id,
    commerce: id,
    commerce_name: commerceName,
    status: 'ACCEPTED',
    dispatch_date: '2026-04-22',
    delivery_slot: 8,
    delivery_slot_name: 'Maniana',
    delivery_window_start: '08:00:00',
    delivery_window_end: '12:00:00',
    delivery_address: `${commerceName} 123`,
    address_snapshot: {},
    lat: '-34.5841000',
    lng: '-58.4351000',
    planned_weight_kg: plannedWeightKg,
    planned_volume_m3: plannedVolumeM3,
    routable: true,
    exclusion_reason: '',
  }
}

function jsonResponse(data: unknown) {
  return Promise.resolve({
    ok: true,
    status: 200,
    json: () => Promise.resolve(data),
  } as Response)
}

describe('DistroMaxi frontend flows', () => {
  beforeEach(() => {
    localStorage.clear()
    useCartStore.setState({ items: [] })
    useAuthStore.setState({ user: null, token: null, loading: false })
    useFeedbackStore.setState({ toasts: [], confirmDialog: null })
    vi.stubGlobal('fetch', vi.fn())
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('logs in and stores JWT tokens', async () => {
    vi.mocked(fetch).mockReturnValue(
      jsonResponse({
        access: 'access-token',
        refresh: 'refresh-token',
        user: {
          id: 1,
          email: 'ventas@andina.local',
          full_name: 'Ventas',
          phone: '',
          role: 'DISTRIBUTOR',
          is_active: true,
          distributor_access: activeDistributorAccess,
        },
      }),
    )

    renderWithFeedback(
      <MemoryRouter>
        <LoginPage />
      </MemoryRouter>,
    )

    await userEvent.type(screen.getByLabelText(/^email$/i), 'ventas@andina.local')
    await userEvent.type(screen.getByLabelText(/contrasena/i), 'Demo1234!')
    await userEvent.click(screen.getByRole('button', { name: /ingresar/i }))

    await waitFor(() => {
      expect(localStorage.getItem('distromax_access')).toBe('access-token')
    })
  })

  it('registers only client accounts from the public form', async () => {
    vi.mocked(fetch).mockReturnValue(
      jsonResponse({
        id: 2,
        email: 'ana@test.local',
        full_name: 'Ana Perez',
        phone: '1111-2222',
        role: 'COMMERCE',
        is_active: true,
        distributor_access: inactiveDistributorAccess,
      }),
    )

    renderWithFeedback(
      <MemoryRouter>
        <RegisterPage />
      </MemoryRouter>,
    )

    expect(screen.queryByLabelText(/^rol$/i)).not.toBeInTheDocument()

    await userEvent.type(screen.getByLabelText(/nombre completo/i), 'Ana Perez')
    await userEvent.type(screen.getByLabelText(/nombre comercial/i), 'Almacen Ana')
    await userEvent.type(screen.getByLabelText(/^email$/i), 'ana@test.local')
    await userEvent.type(screen.getByLabelText(/telefono/i), '1111-2222')
    await userEvent.type(screen.getByLabelText(/contrasena/i), 'Demo1234!')
    await userEvent.click(screen.getByLabelText(/acepto los/i))

    await userEvent.click(screen.getByRole('button', { name: /crear cuenta/i }))

    await waitFor(() => {
      const registerCall = vi.mocked(fetch).mock.calls.find(([url]) => String(url).includes('/auth/register'))
      expect(registerCall).toBeTruthy()
      expect(JSON.parse(String(registerCall?.[1]?.body))).toMatchObject({
        full_name: 'Ana Perez',
        trade_name: 'Almacen Ana',
        email: 'ana@test.local',
        phone: '1111-2222',
        accept_terms: true,
      })
      expect(JSON.parse(String(registerCall?.[1]?.body))).not.toHaveProperty('role')
      expect(JSON.parse(String(registerCall?.[1]?.body))).not.toHaveProperty('address')
      expect(JSON.parse(String(registerCall?.[1]?.body))).not.toHaveProperty('city')
      expect(JSON.parse(String(registerCall?.[1]?.body))).not.toHaveProperty('province')
    })

    expect(await screen.findByText(/cuenta de cliente creada/i)).toBeInTheDocument()
  })

  it('registers distributors through the new public onboarding and auto logs in', async () => {
    vi.mocked(fetch).mockImplementation((input) => {
      const url = String(input)
      if (url.includes('/auth/register-distributor')) {
        return jsonResponse({
          user: {
            id: 3,
            email: 'delta@test.local',
            full_name: 'Claudia Perez',
            phone: '1111-2222',
            role: 'DISTRIBUTOR',
            is_active: true,
            distributor_access: pendingDistributorAccess,
          },
          onboarding: {
            access_state: 'ONBOARDING',
            status: 'ACCOUNT_CREATED',
            onboarding_id: 7,
            distributor_id: null,
            business_name: 'Distribuidora Delta',
            tax_id: '30-12345678-9',
            contact_name: 'Claudia Perez',
            email: 'delta@test.local',
            phone: '1111-2222',
            selected_plan: null,
            checkout_url: '',
            review_reason: '',
            failure_reason: '',
            mercado_pago_status: '',
            checkout_started_at: null,
            activated_at: null,
            created_at: null,
            updated_at: null,
          },
        })
      }
      if (url.includes('/auth/login')) {
        return jsonResponse({
          access: 'dist-access',
          refresh: 'dist-refresh',
          user: {
            id: 3,
            email: 'delta@test.local',
            full_name: 'Claudia Perez',
            phone: '1111-2222',
            role: 'DISTRIBUTOR',
            is_active: true,
            distributor_access: pendingDistributorAccess,
          },
        })
      }
      if (url.includes('/plans')) {
        return jsonResponse([])
      }
      return jsonResponse({})
    })

    renderWithFeedback(
      <MemoryRouter>
        <DistributorRegisterPage />
      </MemoryRouter>,
    )

    await userEvent.type(screen.getByLabelText(/razon social/i), 'Distribuidora Delta')
    await userEvent.type(screen.getByLabelText(/contacto principal/i), 'Claudia Perez')
    await userEvent.type(screen.getByLabelText(/^email$/i), 'delta@test.local')
    await userEvent.type(screen.getByLabelText(/telefono/i), '1111-2222')
    await userEvent.type(screen.getByLabelText(/cuit/i), '30-12345678-9')
    await userEvent.type(screen.getByLabelText(/contrasena/i), 'Demo1234!')
    await userEvent.click(screen.getByLabelText(/acepto los/i))
    await userEvent.click(screen.getByRole('button', { name: /seguir con los planes/i }))

    await waitFor(() => {
      expect(localStorage.getItem('distromax_access')).toBe('dist-access')
      expect(vi.mocked(fetch).mock.calls.some(([url]) => String(url).includes('/auth/register-distributor'))).toBe(true)
      expect(vi.mocked(fetch).mock.calls.some(([url]) => String(url).includes('/auth/login'))).toBe(true)
    })
  })

  it('renders distributors before products', async () => {
    vi.mocked(fetch).mockReturnValue(jsonResponse([distributor]))

    renderWithFeedback(
      <MemoryRouter>
        <HomePage />
      </MemoryRouter>,
    )

    expect(await screen.findByText('Distribuidora Andina')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /ver catalogo/i })).toHaveAttribute('href', '/distributors/1')
  })

  it('renders subscription plans from the API', async () => {
    vi.mocked(fetch).mockReturnValue(
      jsonResponse([
        {
          id: 2,
          name: 'MaxiGestion',
          price: '49900.00',
          description: 'Operacion comercial y logistica para distribuidoras con 60 dias gratis.',
          features: ['60 dias de prueba totalmente gratis', 'Dashboard comercial', 'Reportes exportables'],
          currency: 'ARS',
          mp_subscription_url: 'https://www.mercadopago.com.ar/pro',
          mp_preapproval_plan_id: 'pro-plan',
          is_active: true,
          sort_order: 10,
          is_featured: true,
          trial_days: 60,
        },
      ]),
    )

    renderWithFeedback(
      <MemoryRouter>
        <PlansPage />
      </MemoryRouter>,
    )

    expect(screen.getByText(/maxigestion para vender online sin costo durante 60 dias/i)).toBeInTheDocument()
    expect(await screen.findByText('MaxiGestion')).toBeInTheDocument()
    expect(screen.getByText('60 dias gratis')).toBeInTheDocument()
    expect(fetch).toHaveBeenCalledWith(expect.stringContaining('/plans'), expect.any(Object))
  })

  it('starts checkout only after saving the selected plan for pending distributors', async () => {
    useAuthStore.setState({
      user: {
        id: 3,
        email: 'delta@test.local',
        full_name: 'Claudia Perez',
        phone: '1111-2222',
        role: 'DISTRIBUTOR',
        is_active: true,
        distributor_access: pendingDistributorAccess,
      },
      token: 'dist-access',
      loading: false,
    })

    vi.mocked(fetch).mockImplementation((input) => {
      const url = String(input)
      if (url.includes('/distributor-onboarding/select-plan')) {
        return jsonResponse({
          checkout_url: 'https://www.mercadopago.com.ar/subscriptions/checkout?preapproval_plan_id=pro-plan',
          onboarding: {
            access_state: 'ONBOARDING',
            status: 'CHECKOUT_PENDING',
            onboarding_id: 7,
            distributor_id: null,
            business_name: 'Distribuidora Delta',
            tax_id: '30-12345678-9',
            contact_name: 'Claudia Perez',
            email: 'delta@test.local',
            phone: '1111-2222',
            selected_plan: {
              id: 2,
              name: 'MaxiGestion',
              price: '49900.00',
              description: 'Escala tu operacion.',
              features: ['60 dias de prueba totalmente gratis', 'Dashboard comercial'],
              currency: 'ARS',
              mp_subscription_url: 'https://www.mercadopago.com.ar/pro',
              mp_preapproval_plan_id: 'pro-plan',
              is_active: true,
              sort_order: 10,
              is_featured: true,
              trial_days: 60,
            },
            checkout_url: 'https://www.mercadopago.com.ar/subscriptions/checkout?preapproval_plan_id=pro-plan',
            review_reason: '',
            failure_reason: '',
            mercado_pago_status: '',
            checkout_started_at: null,
            activated_at: null,
            created_at: null,
            updated_at: null,
          },
        })
      }
      if (url.includes('/plans')) {
        return jsonResponse([
          {
            id: 2,
            name: 'MaxiGestion',
            price: '49900.00',
            description: 'Escala tu operacion.',
            features: ['60 dias de prueba totalmente gratis', 'Dashboard comercial'],
            currency: 'ARS',
            mp_subscription_url: 'https://www.mercadopago.com.ar/pro',
            mp_preapproval_plan_id: 'pro-plan',
            is_active: true,
            sort_order: 10,
            is_featured: true,
            trial_days: 60,
          },
        ])
      }
      return jsonResponse([])
    })

    renderWithFeedback(
      <MemoryRouter>
        <PlansPage />
      </MemoryRouter>,
    )

    await userEvent.click(await screen.findByRole('button', { name: /empezar prueba gratis/i }))

    await waitFor(() => {
      const selectPlanCall = vi
        .mocked(fetch)
        .mock.calls.find(([url]) => String(url).includes('/distributor-onboarding/select-plan'))
      expect(selectPlanCall).toBeTruthy()
      expect(selectPlanCall?.[1]).toMatchObject({ method: 'POST' })
      expect(JSON.parse(String(selectPlanCall?.[1]?.body))).toMatchObject({ plan_id: 2 })
    })
  })

  it('lets admins configure Mercado Pago URLs for subscription plans', async () => {
    const updatedUrl = 'https://www.mercadopago.com.ar/subscriptions/checkout?preapproval_plan_id=start-updated'
    const plans = [
      {
        id: 2,
        name: 'MaxiGestion',
        price: '49900.00',
        description: 'Escala tu operacion con 60 dias gratis.',
        features: ['60 dias de prueba totalmente gratis', 'Dashboard comercial'],
        currency: 'ARS',
        mp_subscription_url: 'https://www.mercadopago.com.ar/pro',
        mp_preapproval_plan_id: 'pro-plan',
        is_active: true,
        sort_order: 10,
        is_featured: true,
        trial_days: 60,
        max_products: 5000,
        max_drivers: 80,
      },
    ]

    vi.mocked(fetch).mockImplementation((input, options) => {
      const url = String(input)
      if (url.includes('/plans/2/') && options?.method === 'PATCH') {
        return jsonResponse({ ...plans[0], mp_subscription_url: updatedUrl, mp_preapproval_plan_id: 'start-updated' })
      }
      if (url.includes('/plans')) return jsonResponse(plans)
      if (url.includes('/subscriptions')) return jsonResponse([])
      return jsonResponse([])
    })

    renderWithFeedback(
      <MemoryRouter>
        <AdminSubscriptionsPage />
      </MemoryRouter>,
    )

    expect(await screen.findByRole('heading', { name: /^planes$/i })).toBeInTheDocument()

    await userEvent.click(screen.getAllByRole('button', { name: /editar/i })[0])
    const urlInput = screen.getByLabelText(/enlace de pago/i)
    await userEvent.clear(urlInput)
    await userEvent.type(urlInput, updatedUrl)
    await userEvent.clear(screen.getByLabelText(/codigo del plan de cobro/i))
    await userEvent.type(screen.getByLabelText(/codigo del plan de cobro/i), 'start-updated')
    await userEvent.click(screen.getByRole('button', { name: /guardar cambios/i }))

    await waitFor(() => {
      const updateCall = vi
        .mocked(fetch)
        .mock.calls.find(([url, options]) => String(url).includes('/plans/2/') && options?.method === 'PATCH')
      expect(updateCall).toBeTruthy()
      expect(JSON.parse(String(updateCall?.[1]?.body))).toMatchObject({
        mp_subscription_url: updatedUrl,
        mp_preapproval_plan_id: 'start-updated',
        is_active: true,
        trial_days: '60',
      })
    })
  })

  it('shows the customer landing on the root route', () => {
    render(
      <MemoryRouter initialEntries={['/']}>
        <App />
      </MemoryRouter>,
    )

    expect(screen.getByText('Compra mayorista simple para tu negocio.')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /quiero vender con distromaxi/i })).toHaveAttribute('href', '/planes')
  })

  it('renders products inside a distributor catalog', async () => {
    vi.mocked(fetch).mockReturnValueOnce(jsonResponse(distributor)).mockReturnValueOnce(jsonResponse([product]))

    renderWithFeedback(
      <MemoryRouter initialEntries={['/distributors/1']}>
        <Routes>
          <Route path="/distributors/:id" element={<DistributorCatalogPage />} />
        </Routes>
      </MemoryRouter>,
    )

    expect(await screen.findByText('Agua mineral 1.5L x 6')).toBeInTheDocument()
    expect(screen.getByText('$541,67 por unidad')).toBeInTheDocument()
    expect(fetch).toHaveBeenCalledWith(expect.stringContaining('/products/?distributor=1'), expect.any(Object))
  })

  it('calculates cart totals', () => {
    useCartStore.getState().add(product, 2)

    renderWithFeedback(
      <MemoryRouter>
        <CartPage />
      </MemoryRouter>,
    )

    expect(screen.getAllByText('$6.500').length).toBeGreaterThan(0)
    expect(screen.getByText('$541,67 por unidad')).toBeInTheDocument()
  })

  it('keeps cart items from one distributor only', () => {
    useCartStore.getState().add(product, 2)
    const result = useCartStore.getState().add(otherProduct, 1)

    expect(result).toBe('replaced')
    expect(useCartStore.getState().items).toHaveLength(1)
    expect(useCartStore.getState().items[0].product.distributor).toBe(2)
  })

  it('creates checkout orders with line items', async () => {
    useCartStore.getState().add(product, 1)
    vi.mocked(fetch).mockImplementation((input) => {
      const url = String(input)
      if (url.includes('/commerces/')) {
        return jsonResponse([
          {
            id: 1,
            distributor: 1,
            distributor_name: 'Distribuidora Andina',
            trade_name: 'Almacen Luna',
            legal_name: '',
            tax_id: '',
            contact_name: 'Clara',
            email: 'compras@luna.local',
            phone: '111',
            address: 'Humboldt 1400, CABA',
            city: 'CABA',
            province: 'CABA',
            latitude: '-34.5841000',
            longitude: '-58.4351000',
            default_window_start: '08:00:00',
            default_window_end: '14:00:00',
            delivery_notes: '',
            active: true,
          },
        ])
      }
      return jsonResponse({
        id: 10,
        commerce: 1,
        commerce_name: 'Almacen Luna',
        distributor: 1,
        distributor_name: 'Distribuidora Andina',
        total: '3250.00',
        status: 'PENDING',
        dispatch_date: '2026-04-22',
        delivery_address: 'Humboldt 1400, CABA',
        delivery_window_start: '08:00:00',
        delivery_window_end: '14:00:00',
        notes: '',
        items: [],
        created_at: new Date().toISOString(),
      })
    })

    renderWithFeedback(
      <MemoryRouter>
        <CheckoutPage />
      </MemoryRouter>,
    )

    await userEvent.click(await screen.findByRole('button', { name: /enviar pedido/i }))

    await waitFor(() => {
      expect(fetch).toHaveBeenCalledWith(
        expect.stringContaining('/orders/'),
        expect.objectContaining({ method: 'POST' }),
      )
    })
  })

  it('opens a customer summary modal from the orders dashboard', async () => {
    vi.mocked(fetch).mockImplementation((input) => {
      const url = String(input)
      if (url.includes('/orders/')) return jsonResponse([customerSummaryOrder])
      if (url.includes('/commerces/')) return jsonResponse([customerSummaryCommerce])
      if (url.includes('/delivery-slots/')) return jsonResponse([])
      return jsonResponse([])
    })

    renderWithFeedback(
      <MemoryRouter>
        <DashboardOrdersRoutingPage />
      </MemoryRouter>,
    )

    const customerButtons = await screen.findAllByRole('button', { name: /ver datos del cliente almacen luna/i })
    await userEvent.click(customerButtons[0])

    const dialog = screen.getByRole('dialog', { name: /almacen luna/i })
    expect(dialog).toBeInTheDocument()
    expect(screen.getByText('Almacen Luna SRL')).toBeInTheDocument()
    expect(screen.getByText('Clara Luna')).toBeInTheDocument()
    expect(screen.getByText('compras@luna.local')).toBeInTheDocument()
    expect(screen.getByText('Recibe por puerta lateral.')).toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { name: /cerrar datos del cliente/i }))
    expect(screen.queryByRole('dialog', { name: /almacen luna/i })).not.toBeInTheDocument()
  })

  it('shows intelligent stock suggestions and records cycle counts', async () => {
    const criticalStockRow = {
      id: 41,
      stock_item_id: 41,
      warehouse: 3,
      warehouse_name: 'Central',
      product: 9,
      product_name: 'Gaseosa cola x 12',
      sku: 'SKU-LOW',
      supplier: 5,
      supplier_name: 'Proveedor Norte',
      category: 2,
      category_name: 'Bebidas',
      subcategory_name: '',
      unit: 'bulto',
      quantity: '3.000',
      reserved_quantity: '1.000',
      available_quantity: '2.000',
      stock_minimum: '5.000',
      stock_target: '10.000',
      replenishment_multiple: '6.000',
      sold_30d: '30.000',
      daily_sales: '1.000',
      coverage_days: '2.0',
      lead_time_days: 5,
      recommended_qty: '12.000',
      urgency: 'critical',
      reason: 'Disponible por debajo del minimo configurado.',
      is_low: true,
      updated_at: '2026-04-21T10:00:00.000Z',
    }
    const normalStockRow = {
      ...criticalStockRow,
      id: 42,
      stock_item_id: 42,
      product: 10,
      product_name: 'Aceite girasol x 6',
      sku: 'SKU-OK',
      quantity: '40.000',
      reserved_quantity: '4.000',
      available_quantity: '36.000',
      recommended_qty: '0.000',
      urgency: 'ok',
      reason: 'Stock dentro del objetivo.',
      is_low: false,
    }
    const summary = {
      kpis: {
        total_skus: 2,
        out_of_stock: 0,
        low_stock: 1,
        reserved_units: '5.000',
        suggested_skus: 1,
        suggested_units: '12.000',
      },
      rows: [criticalStockRow, normalStockRow],
    }

    vi.mocked(fetch).mockImplementation((input) => {
      const url = String(input)
      if (url.includes('/stock/41/cycle-count/')) {
        return jsonResponse({
          stock_item: {
            id: 41,
            distributor: 1,
            warehouse: 3,
            warehouse_name: 'Central',
            product: 9,
            product_name: 'Gaseosa cola x 12',
            sku: 'SKU-LOW',
            quantity: '7.000',
            reserved_quantity: '1.000',
            available_quantity: '6.000',
            is_low: false,
            updated_at: '2026-04-21T10:05:00.000Z',
          },
          difference: '4.000',
        })
      }
      if (url.includes('/stock/summary/')) return jsonResponse(summary)
      if (url.includes('/stock/replenishment/')) return jsonResponse([criticalStockRow])
      if (url.includes('/product-suppliers/')) {
        return jsonResponse([
          {
            id: 5,
            distributor: 1,
            distributor_name: 'Distribuidora Andina',
            name: 'Proveedor Norte',
            contact_name: 'Compras',
            phone: '111',
            email: 'compras@norte.local',
            lead_time_days: 5,
            active: true,
          },
        ])
      }
      return jsonResponse([])
    })

    renderWithFeedback(
      <MemoryRouter>
        <StockPage />
      </MemoryRouter>,
    )

    expect(await screen.findByText(/stock inteligente/i)).toBeInTheDocument()
    expect((await screen.findAllByText('Gaseosa cola x 12')).length).toBeGreaterThan(0)
    expect(screen.getByText('Aceite girasol x 6')).toBeInTheDocument()
    expect(screen.queryByText(/Disponible por debajo del minimo configurado/i)).not.toBeInTheDocument()
    expect(screen.getByText(/12 unidades/i)).toBeInTheDocument()

    await userEvent.selectOptions(screen.getByLabelText(/urgencia/i), 'critical')
    expect(screen.queryByText('Aceite girasol x 6')).not.toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { name: /contar/i }))
    expect(screen.getByRole('dialog', { name: /conteo fisico/i })).toBeInTheDocument()
    const countedInput = screen.getByLabelText(/cantidad fisica/i)
    await userEvent.clear(countedInput)
    await userEvent.type(countedInput, '7')
    await userEvent.click(screen.getByRole('button', { name: /guardar ajuste/i }))

    await waitFor(() => {
      const cycleCountCall = vi
        .mocked(fetch)
        .mock.calls.find(([url, options]) => String(url).includes('/stock/41/cycle-count/') && options?.method === 'POST')
      expect(cycleCountCall).toBeTruthy()
      expect(JSON.parse(String(cycleCountCall?.[1]?.body))).toMatchObject({ counted_quantity: '7' })
      expect(vi.mocked(fetch).mock.calls.some(([url]) => String(url).includes('/stock/summary/?days=30'))).toBe(true)
      expect(vi.mocked(fetch).mock.calls.some(([url]) => String(url).includes('/stock/replenishment/?days=30'))).toBe(true)
    })
    expect(await screen.findByText(/conteo fisico registrado/i)).toBeInTheDocument()
  })

  it('generates route drafts from the routing dashboard', async () => {
    let generated = false
    vi.mocked(fetch).mockImplementation((input) => {
      const url = String(input)
      if (url.includes('/route-plans/generate/')) {
        generated = true
        return jsonResponse(routePlan)
      }
      if (url.includes('/delivery-slots/')) {
        return jsonResponse([
          {
            id: 8,
            distributor: 1,
            name: 'Maniana',
            start_time: '08:00:00',
            end_time: '12:00:00',
            active: true,
            sort_order: 1,
            created_at: '2026-04-21T10:00:00.000Z',
            updated_at: '2026-04-21T10:00:00.000Z',
          },
        ])
      }
      if (url.includes('/vehicles/')) {
        return jsonResponse([
          {
            id: 4,
            plate: 'AB123CD',
            vehicle_type: 'Camioneta',
            brand: 'Renault',
            model: 'Master',
            year: 2022,
            capacity_kg: '1200.00',
            capacity_m3: '12.000',
            status: 'AVAILABLE',
            active: true,
          },
        ])
      }
      if (url.includes('/drivers/')) {
        return jsonResponse([
          {
            id: 3,
            user_email: 'marta@test.local',
            full_name: 'Marta Chofer',
            license_number: 'B123',
            license_category: 'B2',
            phone: '111',
            emergency_contact: '',
            assigned_vehicle: 4,
            assigned_vehicle_plate: 'AB123CD',
            available: true,
            active: true,
          },
        ])
      }
      if (url.includes('/route-plans/pending-orders/')) return jsonResponse(generated ? [] : [pendingRouteOrder(20, 'Almacen Sol', '10.000', '1.000000')])
      if (url.includes('/route-plans/')) return jsonResponse(generated ? [routePlan] : [])
      return jsonResponse([])
    })

    renderWithFeedback(
      <MemoryRouter>
        <DashboardRoutingPage />
      </MemoryRouter>,
    )

    await screen.findByRole('option', { name: /maniana/i })
    await userEvent.selectOptions(screen.getByLabelText(/franja horaria/i), '8')
    await userEvent.click(await screen.findByRole('checkbox', { name: /AB123CD/i }))
    const generateButton = screen.getByRole('button', { name: /generar rutas/i })
    await waitFor(() => expect(generateButton).toBeEnabled())
    await userEvent.click(generateButton)

    expect(await screen.findByText(/rutas generadas/i)).toBeInTheDocument()
    expect((await screen.findAllByText(/marta chofer/i)).length).toBeGreaterThan(0)
    await waitFor(() => {
      const generateCall = vi.mocked(fetch).mock.calls.find(([url]) => String(url).includes('/route-plans/generate/'))
      expect(JSON.parse(String(generateCall?.[1]?.body))).toMatchObject({ vehicle_ids: [4], delivery_slot_id: 8 })
      expect(JSON.parse(String(generateCall?.[1]?.body))).not.toHaveProperty('vehicle_driver_ids')
      expect(vi.mocked(fetch).mock.calls.some(([url]) => String(url).includes('/route-plans/?') && String(url).includes('dispatch_date=') && String(url).includes('delivery_slot_id=8'))).toBe(true)
      expect(vi.mocked(fetch).mock.calls.some(([url]) => String(url).includes('/route-plans/pending-orders/?') && String(url).includes('dispatch_date=') && String(url).includes('delivery_slot_id=8'))).toBe(true)
    })
  })

  it('summarizes only orders from the selected routing date and slot', async () => {
    const morningPlan = {
      ...routePlan,
      delivery_slot: 8,
      delivery_slot_name: 'Maniana',
      delivery_window_start: '08:00:00',
      delivery_window_end: '12:00:00',
    }
    const afternoonPlan = {
      ...routePlan,
      id: 12,
      route_number: null,
      delivery_slot: 9,
      delivery_slot_name: 'Tarde',
      delivery_window_start: '13:00:00',
      delivery_window_end: '17:00:00',
      total_load_kg: '6.000',
      total_load_m3: '0.200000',
      runs: [
        {
          ...routePlan.runs[0],
          id: 22,
          load_kg: '6.000',
          load_m3: '0.200000',
          stops: [
            {
              ...routePlan.runs[0].stops[0],
              id: 32,
              order: 30,
              commerce_name: 'Comercio Tarde',
              demand_kg: '6.000',
              demand_m3: '0.200000',
            },
          ],
        },
      ],
    }

    vi.mocked(fetch).mockImplementation((input) => {
      const url = String(input)
      if (url.includes('/delivery-slots/')) {
        return jsonResponse([
          {
            id: 8,
            distributor: 1,
            name: 'Maniana',
            start_time: '08:00:00',
            end_time: '12:00:00',
            active: true,
            sort_order: 1,
            created_at: '2026-04-21T10:00:00.000Z',
            updated_at: '2026-04-21T10:00:00.000Z',
          },
          {
            id: 9,
            distributor: 1,
            name: 'Tarde',
            start_time: '13:00:00',
            end_time: '17:00:00',
            active: true,
            sort_order: 2,
            created_at: '2026-04-21T10:00:00.000Z',
            updated_at: '2026-04-21T10:00:00.000Z',
          },
        ])
      }
      if (url.includes('/vehicles/')) return jsonResponse([])
      if (url.includes('/drivers/')) return jsonResponse([])
      if (url.includes('/route-plans/pending-orders/')) {
        const params = new URL(url, 'http://distromax.test').searchParams
        return jsonResponse(
          params.get('delivery_slot_id') === '8'
            ? [
                pendingRouteOrder(10, 'Almacen Luna', '8.000', '0.300000'),
                pendingRouteOrder(20, 'Almacen Sol', '10.000', '1.000000'),
              ]
            : [],
        )
      }
      if (url.includes('/route-plans/')) {
        const params = new URL(url, 'http://distromax.test').searchParams
        return jsonResponse(params.get('delivery_slot_id') === '8' ? [morningPlan] : [afternoonPlan])
      }
      return jsonResponse([])
    })

    renderWithFeedback(
      <MemoryRouter>
        <DashboardRoutingPage />
      </MemoryRouter>,
    )

    await screen.findByRole('option', { name: /maniana/i })
    await userEvent.selectOptions(screen.getByLabelText(/franja horaria/i), '8')

    expect(await screen.findByText(/pedidos filtrados: 2/i)).toBeInTheDocument()
    expect(screen.getByText(/carga filtrada: 18 kg - 1,3 m3/i)).toBeInTheDocument()
    await waitFor(() => {
      expect(vi.mocked(fetch).mock.calls.some(([url]) => String(url).includes('/route-plans/?') && String(url).includes('dispatch_date=') && String(url).includes('delivery_slot_id=8'))).toBe(true)
      expect(vi.mocked(fetch).mock.calls.some(([url]) => String(url).includes('/route-plans/pending-orders/?') && String(url).includes('dispatch_date=') && String(url).includes('delivery_slot_id=8'))).toBe(true)
    })

    await userEvent.selectOptions(screen.getByLabelText(/franja horaria/i), '9')

    expect(await screen.findByText(/pedidos filtrados: 1/i)).toBeInTheDocument()
    expect(screen.getByText(/carga filtrada: 6 kg - 0,2 m3/i)).toBeInTheDocument()
    expect(screen.getByText(/comercio tarde/i)).toBeInTheDocument()
    expect(screen.queryByText(/almacen sol/i)).not.toBeInTheDocument()
  })

  it('renders the driver current route instead of a flat deliveries list', async () => {
    vi.mocked(fetch).mockImplementation((input) => {
      const url = String(input)
      if (url.includes('/routes/me/current/')) return jsonResponse(currentRoute)
      return jsonResponse(currentRoute)
    })

    renderWithFeedback(
      <MemoryRouter>
        <DriverDeliveriesPage />
      </MemoryRouter>,
    )

    expect(await screen.findByText(/mi ruta actual/i)).toBeInTheDocument()
    expect(screen.getByText(/almacen luna/i)).toBeInTheDocument()
    expect(screen.getAllByRole('button', { name: /abrir navegacion/i }).length).toBeGreaterThan(0)
  })
})

function renderWithFeedback(ui: ReactNode) {
  return render(
    <>
      {ui}
      <FeedbackLayer />
    </>,
  )
}
