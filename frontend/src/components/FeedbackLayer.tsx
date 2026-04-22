import { useEffect, useRef } from 'react'

import { useFeedbackStore } from '../stores/feedbackStore'

export function FeedbackLayer() {
  const toasts = useFeedbackStore((state) => state.toasts)
  const confirmDialog = useFeedbackStore((state) => state.confirmDialog)
  const dismissToast = useFeedbackStore((state) => state.dismissToast)
  const resolveConfirm = useFeedbackStore((state) => state.resolveConfirm)
  const cancelButtonRef = useRef<HTMLButtonElement | null>(null)

  useEffect(() => {
    if (!confirmDialog) return

    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    cancelButtonRef.current?.focus()

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') resolveConfirm(false)
    }

    window.addEventListener('keydown', onKeyDown)
    return () => {
      document.body.style.overflow = previousOverflow
      window.removeEventListener('keydown', onKeyDown)
    }
  }, [confirmDialog, resolveConfirm])

  return (
    <>
      <div className="pointer-events-none fixed bottom-4 left-4 z-[1400] flex w-[calc(100vw-2rem)] max-w-sm flex-col gap-3">
        {toasts.map((toast) => (
          <article
            key={toast.id}
            className={`pointer-events-auto rounded-[1.35rem] border px-4 py-4 shadow-[0_22px_44px_-28px_rgba(15,23,42,0.45)] backdrop-blur ${toastToneClass(
              toast.tone,
            )}`}
            role="status"
            aria-live="polite"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-sm font-800">{toast.title}</p>
                <p className="mt-1 text-sm leading-6 opacity-95">{toast.message}</p>
              </div>
              <button
                className="min-h-8 min-w-8 rounded-full border border-current/15 px-2 text-xs font-800 opacity-80 transition hover:opacity-100"
                type="button"
                onClick={() => dismissToast(toast.id)}
                aria-label="Cerrar aviso"
              >
                X
              </button>
            </div>
          </article>
        ))}
      </div>

      {confirmDialog && (
        <div
          className="fixed inset-0 z-[1500] grid place-items-end bg-slate-950/50 p-0 sm:place-items-center sm:p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="feedback-confirm-title"
          onClick={() => resolveConfirm(false)}
        >
          <div
            className="w-full max-w-lg rounded-t-[1.8rem] border border-slate-200 bg-white p-5 shadow-[0_36px_80px_-32px_rgba(15,23,42,0.45)] sm:rounded-[1.8rem] sm:p-6"
            onClick={(event) => event.stopPropagation()}
          >
            <p className="text-xs font-800 uppercase tracking-[0.16em] text-slate-500">Confirmacion</p>
            <h2 id="feedback-confirm-title" className="mt-3 text-2xl font-800 text-slate-950">
              {confirmDialog.title}
            </h2>
            <p className="mt-3 text-sm leading-7 text-slate-600">{confirmDialog.message}</p>

            <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
              <button
                ref={cancelButtonRef}
                className="min-h-11 rounded-full border border-slate-300 px-5 text-sm font-800 text-slate-700 transition hover:bg-slate-50"
                type="button"
                onClick={() => resolveConfirm(false)}
              >
                {confirmDialog.cancelLabel}
              </button>
              <button
                className={`min-h-11 rounded-full px-5 text-sm font-800 text-white transition ${confirmButtonClass(confirmDialog.tone)}`}
                type="button"
                onClick={() => resolveConfirm(true)}
              >
                {confirmDialog.confirmLabel}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

function toastToneClass(tone: 'success' | 'error' | 'info' | 'warning') {
  if (tone === 'success') return 'border-emerald-200 bg-emerald-50 text-emerald-950'
  if (tone === 'error') return 'border-red-200 bg-red-50 text-red-950'
  if (tone === 'warning') return 'border-amber-200 bg-amber-50 text-amber-950'
  return 'border-slate-200 bg-white text-slate-950'
}

function confirmButtonClass(tone: 'primary' | 'danger') {
  return tone === 'danger' ? 'bg-red-600 hover:bg-red-700' : 'bg-brand-600 hover:bg-brand-700'
}
