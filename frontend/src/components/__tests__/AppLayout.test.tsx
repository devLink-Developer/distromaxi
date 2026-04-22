import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { beforeEach, describe, expect, it } from 'vitest'

import { useAuthStore } from '../../stores/authStore'
import { AppLayout } from '../AppLayout'

const distributorUser = {
  id: 1,
  email: 'ventas@andina.local',
  full_name: 'Ventas Distribuidora',
  phone: '111111111',
  role: 'DISTRIBUTOR' as const,
  is_active: true,
  distributor_access: {
    state: 'ACTIVE' as const,
    onboarding_status: 'ACTIVE',
    onboarding_id: 7,
    distributor_id: 3,
    distributor_name: 'Distribuidora Andina',
  },
}

describe('AppLayout', () => {
  beforeEach(() => {
    localStorage.clear()
    useAuthStore.setState({ user: distributorUser, token: 'test-token', loading: false })
  })

  it('opens the complete mobile menu for distributor routes beyond the quick links', async () => {
    render(
      <MemoryRouter initialEntries={['/dashboard']}>
        <Routes>
          <Route element={<AppLayout />}>
            <Route path="/dashboard" element={<div>Dashboard</div>} />
            <Route path="/dashboard/vehicles" element={<div>Pantalla vehiculos</div>} />
            <Route path="/dashboard/billing" element={<div>Plan</div>} />
          </Route>
        </Routes>
      </MemoryRouter>,
    )

    expect(screen.queryByRole('dialog', { name: /menu de navegacion/i })).not.toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { name: /abrir menu completo/i }))

    const dialog = screen.getByRole('dialog', { name: /menu de navegacion/i })

    expect(within(dialog).getByRole('link', { name: /vehiculos/i })).toBeInTheDocument()
    expect(within(dialog).getByRole('link', { name: /plan/i })).toBeInTheDocument()

    await userEvent.click(within(dialog).getByRole('link', { name: /vehiculos/i }))

    expect(screen.queryByRole('dialog', { name: /menu de navegacion/i })).not.toBeInTheDocument()
    expect(screen.getByText('Pantalla vehiculos')).toBeInTheDocument()
  })
})
