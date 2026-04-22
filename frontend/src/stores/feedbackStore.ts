import { create } from 'zustand'

export type ToastTone = 'success' | 'error' | 'info' | 'warning'

export type ToastItem = {
  id: number
  title: string
  message: string
  tone: ToastTone
  duration: number
}

export type ConfirmOptions = {
  title: string
  message: string
  confirmLabel?: string
  cancelLabel?: string
  tone?: 'primary' | 'danger'
}

type ConfirmDialog = Required<Omit<ConfirmOptions, 'tone'>> & {
  tone: 'primary' | 'danger'
  resolver: (value: boolean) => void
}

type FeedbackState = {
  toasts: ToastItem[]
  confirmDialog: ConfirmDialog | null
  showToast: (input: {
    title?: string
    message: string
    tone?: ToastTone
    duration?: number
  }) => number
  success: (message: string, title?: string) => number
  error: (message: string, title?: string) => number
  info: (message: string, title?: string) => number
  warning: (message: string, title?: string) => number
  dismissToast: (id: number) => void
  confirm: (options: ConfirmOptions) => Promise<boolean>
  resolveConfirm: (value: boolean) => void
}

let nextToastId = 1
const toastTimers = new Map<number, number>()

export const useFeedbackStore = create<FeedbackState>((set, get) => ({
  toasts: [],
  confirmDialog: null,

  showToast(input) {
    const id = nextToastId++
    const toast: ToastItem = {
      id,
      title: input.title ?? defaultToastTitle(input.tone ?? 'info'),
      message: input.message,
      tone: input.tone ?? 'info',
      duration: input.duration ?? 4200,
    }

    set((state) => ({ toasts: [...state.toasts, toast] }))

    if (toast.duration > 0) {
      const timer = window.setTimeout(() => {
        get().dismissToast(id)
      }, toast.duration)
      toastTimers.set(id, timer)
    }

    return id
  },

  success(message, title) {
    return get().showToast({ message, title, tone: 'success' })
  },

  error(message, title) {
    return get().showToast({ message, title, tone: 'error' })
  },

  info(message, title) {
    return get().showToast({ message, title, tone: 'info' })
  },

  warning(message, title) {
    return get().showToast({ message, title, tone: 'warning' })
  },

  dismissToast(id) {
    const timer = toastTimers.get(id)
    if (timer) {
      window.clearTimeout(timer)
      toastTimers.delete(id)
    }
    set((state) => ({ toasts: state.toasts.filter((toast) => toast.id !== id) }))
  },

  confirm(options) {
    const current = get().confirmDialog
    current?.resolver(false)

    return new Promise<boolean>((resolve) => {
      set({
        confirmDialog: {
          title: options.title,
          message: options.message,
          confirmLabel: options.confirmLabel ?? 'Confirmar',
          cancelLabel: options.cancelLabel ?? 'Cancelar',
          tone: options.tone ?? 'primary',
          resolver: resolve,
        },
      })
    })
  },

  resolveConfirm(value) {
    const dialog = get().confirmDialog
    if (!dialog) return
    dialog.resolver(value)
    set({ confirmDialog: null })
  },
}))

function defaultToastTitle(tone: ToastTone) {
  if (tone === 'success') return 'Listo'
  if (tone === 'error') return 'Atencion'
  if (tone === 'warning') return 'Revisa esto'
  return 'Aviso'
}
