import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { App } from '../../app/App'
import { useAuthStore } from '../../stores/authStore'
import { useCartStore } from '../../stores/cartStore'
import type { Product } from '../../types/domain'
import { LoginPage, RegisterPage } from '../AuthPages'
import { CartPage, CheckoutPage, DistributorCatalogPage, HomePage } from '../CommercePages'
import { AdminSubscriptionsPage } from '../DashboardPages'
import { DistributorRegisterPage } from '../DistributorOnboardingPages'
import { PlansPage } from '../PlansPage'

const inactiveDistributorAccess = {
  state: 'NONE' as const,
  onboarding_status: null,
  onboarding_id: null,
  distributor_id: null,
  distributor_name: null,
}

const pendingDistributorAccess = {
  state: 'ONBOARDING' as const,
  onboarding_status: 'CHECKOUT_PENDING',
  onboarding_id: 7,
  distributor_id: null,
  distributor_name: null,
}

const activeDistributorAccess = {
  state: 'ACTIVE' as const,
  onboarding_status: 'ACTIVE',
  onboarding_id: 7,
  distributor_id: 3,
  distributor_name: 'Distribuidora Andina',
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
  address: 'Av. San Martin 2450',
  city: 'Buenos Aires',
  province: 'CABA',
  latitude: '-34.6037220',
  longitude: '-58.3815920',
  currency: 'ARS',
  plan_name: 'Mayorista',
  subscription_status: 'ACTIVE',
  mercado_pago_link: '',
  can_operate: true,
  active: true,
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

    render(
      <MemoryRouter>
        <LoginPage />
      </MemoryRouter>,
    )

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

    render(
      <MemoryRouter>
        <RegisterPage />
      </MemoryRouter>,
    )

    expect(screen.queryByLabelText(/^rol$/i)).not.toBeInTheDocument()

    await userEvent.type(screen.getByLabelText(/nombre completo/i), 'Ana Perez')
    await userEvent.type(screen.getByLabelText(/nombre del negocio/i), 'Almacen Ana')
    await userEvent.type(screen.getByLabelText(/^email$/i), 'ana@test.local')
    await userEvent.type(screen.getByLabelText(/telefono/i), '1111-2222')
    await userEvent.type(screen.getByLabelText(/direccion de entrega/i), 'Calle 123')
    await userEvent.type(screen.getByLabelText(/ciudad/i), 'CABA')
    await userEvent.type(screen.getByLabelText(/provincia/i), 'Buenos Aires')
    await userEvent.type(screen.getByLabelText(/contrasena/i), 'Demo1234!')

    await userEvent.click(screen.getByRole('button', { name: /crear cuenta/i }))

    await waitFor(() => {
      const registerCall = vi.mocked(fetch).mock.calls.find(([url]) => String(url).includes('/auth/register'))
      expect(registerCall).toBeTruthy()
      expect(JSON.parse(String(registerCall?.[1]?.body))).toMatchObject({
        full_name: 'Ana Perez',
        trade_name: 'Almacen Ana',
        email: 'ana@test.local',
        phone: '1111-2222',
        address: 'Calle 123',
        city: 'CABA',
        province: 'Buenos Aires',
      })
      expect(JSON.parse(String(registerCall?.[1]?.body))).not.toHaveProperty('role')
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

    render(
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
    await userEvent.click(screen.getByRole('button', { name: /continuar a planes/i }))

    await waitFor(() => {
      expect(localStorage.getItem('distromax_access')).toBe('dist-access')
      expect(vi.mocked(fetch).mock.calls.some(([url]) => String(url).includes('/auth/register-distributor'))).toBe(true)
      expect(vi.mocked(fetch).mock.calls.some(([url]) => String(url).includes('/auth/login'))).toBe(true)
    })
  })

  it('renders distributors before products', async () => {
    vi.mocked(fetch).mockReturnValue(jsonResponse([distributor]))

    render(
      <MemoryRouter>
        <HomePage />
      </MemoryRouter>,
    )

    expect(await screen.findByText('Distribuidora Andina')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /ver art/i })).toHaveAttribute('href', '/distributors/1')
  })

  it('renders subscription plans from the API', async () => {
    vi.mocked(fetch).mockReturnValue(
      jsonResponse([
        {
          id: 1,
          name: 'START',
          price: '19900.00',
          description: 'Ideal para comenzar. Gestion basica de pedidos.',
          currency: 'ARS',
          mp_subscription_url: 'https://www.mercadopago.com.ar/start',
          mp_preapproval_plan_id: 'start-plan',
          is_active: true,
          sort_order: 10,
          is_featured: false,
        },
        {
          id: 2,
          name: 'PRO',
          price: '49900.00',
          description: 'Escala tu operacion. Estadisticas avanzadas. Mejor control.',
          currency: 'ARS',
          mp_subscription_url: 'https://www.mercadopago.com.ar/pro',
          mp_preapproval_plan_id: 'pro-plan',
          is_active: true,
          sort_order: 20,
          is_featured: true,
        },
      ]),
    )

    render(
      <MemoryRouter>
        <PlansPage />
      </MemoryRouter>,
    )

    expect(screen.getByText(/vende mas\. automatiza tu distribucion/i)).toBeInTheDocument()
    expect(await screen.findByText('START')).toBeInTheDocument()
    expect(screen.getByText('Mas elegido')).toBeInTheDocument()
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
              name: 'PRO',
              price: '49900.00',
              description: 'Escala tu operacion.',
              currency: 'ARS',
              mp_subscription_url: 'https://www.mercadopago.com.ar/pro',
              mp_preapproval_plan_id: 'pro-plan',
              is_active: true,
              sort_order: 20,
              is_featured: true,
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
            name: 'PRO',
            price: '49900.00',
            description: 'Escala tu operacion.',
            currency: 'ARS',
            mp_subscription_url: 'https://www.mercadopago.com.ar/pro',
            mp_preapproval_plan_id: 'pro-plan',
            is_active: true,
            sort_order: 20,
            is_featured: true,
          },
        ])
      }
      return jsonResponse([])
    })

    render(
      <MemoryRouter>
        <PlansPage />
      </MemoryRouter>,
    )

    await userEvent.click(await screen.findByRole('button', { name: /elegir este plan/i }))

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
        id: 1,
        name: 'START',
        price: '19900.00',
        description: 'Ideal para comenzar. Gestion basica de pedidos.',
        currency: 'ARS',
        mp_subscription_url: 'https://www.mercadopago.com.ar/start',
        mp_preapproval_plan_id: 'start-plan',
        is_active: true,
        sort_order: 10,
        is_featured: false,
        max_products: 500,
        max_drivers: 10,
      },
      {
        id: 2,
        name: 'PRO',
        price: '49900.00',
        description: 'Escala tu operacion. Estadisticas avanzadas.',
        currency: 'ARS',
        mp_subscription_url: 'https://www.mercadopago.com.ar/pro',
        mp_preapproval_plan_id: 'pro-plan',
        is_active: true,
        sort_order: 20,
        is_featured: true,
        max_products: 5000,
        max_drivers: 80,
      },
    ]

    vi.mocked(fetch).mockImplementation((input, options) => {
      const url = String(input)
      if (url.includes('/plans/1/') && options?.method === 'PATCH') {
        return jsonResponse({ ...plans[0], mp_subscription_url: updatedUrl, mp_preapproval_plan_id: 'start-updated' })
      }
      if (url.includes('/plans')) return jsonResponse(plans)
      if (url.includes('/subscriptions')) return jsonResponse([])
      return jsonResponse([])
    })

    render(
      <MemoryRouter>
        <AdminSubscriptionsPage />
      </MemoryRouter>,
    )

    expect(await screen.findByText(/planes de suscrip/i)).toBeInTheDocument()

    await userEvent.click(screen.getAllByRole('button', { name: /editar/i })[0])
    const urlInput = screen.getByLabelText(/link mercado pago/i)
    await userEvent.clear(urlInput)
    await userEvent.type(urlInput, updatedUrl)
    await userEvent.clear(screen.getByLabelText(/preapproval plan id/i))
    await userEvent.type(screen.getByLabelText(/preapproval plan id/i), 'start-updated')
    await userEvent.click(screen.getByRole('button', { name: /guardar cambios/i }))

    await waitFor(() => {
      const updateCall = vi
        .mocked(fetch)
        .mock.calls.find(([url, options]) => String(url).includes('/plans/1/') && options?.method === 'PATCH')
      expect(updateCall).toBeTruthy()
      expect(JSON.parse(String(updateCall?.[1]?.body))).toMatchObject({
        mp_subscription_url: updatedUrl,
        mp_preapproval_plan_id: 'start-updated',
        is_active: true,
      })
    })
  })

  it('shows the customer landing on the root route', () => {
    render(
      <MemoryRouter initialEntries={['/']}>
        <App />
      </MemoryRouter>,
    )

    expect(screen.getByText('Hace tus pedidos a distribuidoras desde un solo lugar.')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /quiero vender con distromaxi/i })).toHaveAttribute('href', '/planes')
  })

  it('renders products inside a distributor catalog', async () => {
    vi.mocked(fetch).mockReturnValueOnce(jsonResponse(distributor)).mockReturnValueOnce(jsonResponse([product]))

    render(
      <MemoryRouter initialEntries={['/distributors/1']}>
        <Routes>
          <Route path="/distributors/:id" element={<DistributorCatalogPage />} />
        </Routes>
      </MemoryRouter>,
    )

    expect(await screen.findByText('Agua mineral 1.5L x 6')).toBeInTheDocument()
    expect(fetch).toHaveBeenCalledWith(expect.stringContaining('/products/?distributor=1'), expect.any(Object))
  })

  it('calculates cart totals', () => {
    useCartStore.getState().add(product, 2)

    render(
      <MemoryRouter>
        <CartPage />
      </MemoryRouter>,
    )

    expect(screen.getByText('$6.500')).toBeInTheDocument()
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
    vi.mocked(fetch).mockReturnValue(
      jsonResponse({
        id: 10,
        commerce: 1,
        commerce_name: 'Almacen Luna',
        distributor: 1,
        distributor_name: 'Distribuidora Andina',
        total: '3250.00',
        status: 'PENDING',
        delivery_address: 'Humboldt 1400, CABA',
        notes: '',
        items: [],
        created_at: new Date().toISOString(),
      }),
    )

    render(
      <MemoryRouter>
        <CheckoutPage />
      </MemoryRouter>,
    )

    await userEvent.click(screen.getByRole('button', { name: /confirmar pedido/i }))

    await waitFor(() => {
      expect(fetch).toHaveBeenCalledWith(
        expect.stringContaining('/orders/'),
        expect.objectContaining({ method: 'POST' }),
      )
    })
  })
})
