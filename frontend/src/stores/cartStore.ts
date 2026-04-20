import { create } from 'zustand'

import type { CartItem, Product } from '../types/domain'

type CartState = {
  items: CartItem[]
  add: (product: Product, quantity?: number) => 'added' | 'replaced'
  remove: (productId: number) => void
  setQuantity: (productId: number, quantity: number) => void
  clear: () => void
  distributorId: () => number | null
  distributorName: () => string
  total: () => number
}

export const useCartStore = create<CartState>((set, get) => ({
  items: [],
  add(product, quantity = 1) {
    let result: 'added' | 'replaced' = 'added'
    set((state) => {
      const currentDistributor = state.items[0]?.product.distributor
      if (currentDistributor && currentDistributor !== product.distributor) {
        result = 'replaced'
        return { items: [{ product, quantity }] }
      }
      const existing = state.items.find((item) => item.product.id === product.id)
      if (existing) {
        return {
          items: state.items.map((item) =>
            item.product.id === product.id ? { ...item, quantity: item.quantity + quantity } : item,
          ),
        }
      }
      return { items: [...state.items, { product, quantity }] }
    })
    return result
  },
  remove(productId) {
    set((state) => ({ items: state.items.filter((item) => item.product.id !== productId) }))
  },
  setQuantity(productId, quantity) {
    if (quantity <= 0) {
      get().remove(productId)
      return
    }
    set((state) => ({
      items: state.items.map((item) => (item.product.id === productId ? { ...item, quantity } : item)),
    }))
  },
  clear() {
    set({ items: [] })
  },
  distributorId() {
    return get().items[0]?.product.distributor ?? null
  },
  distributorName() {
    return get().items[0]?.product.distributor_name ?? ''
  },
  total() {
    return get().items.reduce((sum, item) => sum + Number(item.product.price) * item.quantity, 0)
  },
}))
