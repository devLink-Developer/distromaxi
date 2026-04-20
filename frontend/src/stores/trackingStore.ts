import { create } from 'zustand'

import { api } from '../services/api'
import type { Delivery } from '../types/domain'

type TrackingState = {
  delivery: Delivery | null
  loading: boolean
  fetchDelivery: (id: number | string) => Promise<void>
  sendLocation: (id: number, position: GeolocationPosition) => Promise<void>
}

export const useTrackingStore = create<TrackingState>((set) => ({
  delivery: null,
  loading: false,
  async fetchDelivery(id) {
    set({ loading: true })
    const delivery = await api.delivery(id)
    set({ delivery, loading: false })
  },
  async sendLocation(id, position) {
    const delivery = await api.updateDeliveryLocation(id, {
      latitude: position.coords.latitude,
      longitude: position.coords.longitude,
      accuracy_m: position.coords.accuracy,
    })
    set({ delivery })
  },
}))
