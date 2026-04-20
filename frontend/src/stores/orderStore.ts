import { create } from 'zustand'

import { api } from '../services/api'
import type { Order } from '../types/domain'

type OrderState = {
  orders: Order[]
  currentOrder: Order | null
  loading: boolean
  fetchOrders: () => Promise<void>
  createFromCart: (payload: Record<string, unknown>) => Promise<Order>
  updateStatus: (id: number, status: string) => Promise<Order>
}

export const useOrderStore = create<OrderState>((set) => ({
  orders: [],
  currentOrder: null,
  loading: false,
  async fetchOrders() {
    set({ loading: true })
    const orders = await api.orders()
    set({ orders, loading: false })
  },
  async createFromCart(payload) {
    const order = await api.createOrder(payload)
    set((state) => ({ currentOrder: order, orders: [order, ...state.orders] }))
    return order
  },
  async updateStatus(id, status) {
    const order = await api.updateOrderStatus(id, status)
    set((state) => ({ orders: state.orders.map((item) => (item.id === id ? order : item)) }))
    return order
  },
}))
