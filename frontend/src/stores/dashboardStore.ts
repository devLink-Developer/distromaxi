import { create } from 'zustand'

import { api } from '../services/api'
import type { DashboardBundle, DashboardFilters } from '../types/domain'

function isoDate(offsetDays = 0) {
  const date = new Date()
  date.setDate(date.getDate() + offsetDays)
  return date.toISOString().slice(0, 10)
}

export const defaultDashboardFilters: DashboardFilters = {
  date_from: isoDate(-30),
  date_to: isoDate(0),
  granularity: 'day',
  zone: '',
}

type DashboardState = {
  filters: DashboardFilters
  data: DashboardBundle | null
  loading: boolean
  error: string
  setFilters: (filters: Partial<DashboardFilters>) => void
  fetchDashboard: () => Promise<void>
}

export const useDashboardStore = create<DashboardState>((set, get) => ({
  filters: defaultDashboardFilters,
  data: null,
  loading: false,
  error: '',
  setFilters(filters) {
    set((state) => ({ filters: { ...state.filters, ...filters } }))
  },
  async fetchDashboard() {
    set({ loading: true, error: '' })
    try {
      const data = await api.dashboard(get().filters)
      set({ data, loading: false })
    } catch (error) {
      set({ error: error instanceof Error ? error.message : 'No se pudo cargar el dashboard.', loading: false })
    }
  },
}))
