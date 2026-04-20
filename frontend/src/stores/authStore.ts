import { create } from 'zustand'

import { api, clearAuthTokens, setAuthTokens } from '../services/api'
import type { Role, User } from '../types/domain'

type AuthState = {
  user: User | null
  token: string | null
  loading: boolean
  login: (email: string, password: string) => Promise<User>
  register: (payload: Record<string, unknown>) => Promise<void>
  bootstrap: () => Promise<void>
  logout: () => void
  hasRole: (roles: Role[]) => boolean
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  token: localStorage.getItem('distromax_access'),
  loading: false,
  async login(email, password) {
    set({ loading: true })
    try {
      const data = await api.login(email, password)
      setAuthTokens(data.access, data.refresh)
      set({ user: data.user, token: data.access, loading: false })
      return data.user
    } catch (error) {
      set({ loading: false })
      throw error
    }
  },
  async register(payload) {
    await api.register(payload)
  },
  async bootstrap() {
    if (!localStorage.getItem('distromax_access')) return
    set({ loading: true })
    try {
      const user = await api.me()
      set({ user, token: localStorage.getItem('distromax_access'), loading: false })
    } catch {
      clearAuthTokens()
      set({ user: null, token: null, loading: false })
    }
  },
  logout() {
    clearAuthTokens()
    set({ user: null, token: null })
  },
  hasRole(roles) {
    const user = get().user
    return Boolean(user && roles.includes(user.role))
  },
}))
