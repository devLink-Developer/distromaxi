import { useEffect } from 'react'

import { useDashboardStore } from '../stores/dashboardStore'

export function useDashboard(pollMs = 30000) {
  const filters = useDashboardStore((state) => state.filters)
  const data = useDashboardStore((state) => state.data)
  const loading = useDashboardStore((state) => state.loading)
  const error = useDashboardStore((state) => state.error)
  const setFilters = useDashboardStore((state) => state.setFilters)
  const fetchDashboard = useDashboardStore((state) => state.fetchDashboard)

  useEffect(() => {
    void fetchDashboard()
    const interval = window.setInterval(() => {
      void fetchDashboard()
    }, pollMs)
    return () => window.clearInterval(interval)
  }, [fetchDashboard, filters, pollMs])

  return { filters, data, loading, error, setFilters, refresh: fetchDashboard }
}
