import { create } from 'zustand'

import { api } from '../services/api'
import type { NotificationEvent } from '../types/domain'

type NotificationState = {
  notifications: NotificationEvent[]
  permission: NotificationPermission | 'unsupported'
  fetchNotifications: () => Promise<void>
  enablePush: () => Promise<void>
}

function urlBase64ToUint8Array(base64String: string) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const rawData = window.atob(base64)
  return Uint8Array.from([...rawData].map((char) => char.charCodeAt(0)))
}

export const useNotificationStore = create<NotificationState>((set) => ({
  notifications: [],
  permission: 'Notification' in window ? Notification.permission : 'unsupported',
  async fetchNotifications() {
    const notifications = await api.notifications()
    set({ notifications })
  },
  async enablePush() {
    if (!('serviceWorker' in navigator) || !('PushManager' in window) || !('Notification' in window)) {
      set({ permission: 'unsupported' })
      return
    }
    const permission = await Notification.requestPermission()
    set({ permission })
    if (permission !== 'granted') return
    const registration = await navigator.serviceWorker.ready
    const { public_key: publicKey } = await api.vapidPublicKey()
    if (!publicKey) return
    const subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(publicKey),
    })
    const json = subscription.toJSON()
    await api.savePushSubscription({
      endpoint: json.endpoint,
      p256dh: json.keys?.p256dh,
      auth: json.keys?.auth,
      user_agent: navigator.userAgent,
    })
    await api.sendTestPush()
  },
}))
