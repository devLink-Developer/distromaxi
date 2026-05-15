import { useEffect, useMemo, useRef, useState } from 'react'
import type { FormEvent } from 'react'

import { api } from '../services/api'
import { useAuthStore } from '../stores/authStore'
import { useFeedbackStore } from '../stores/feedbackStore'
import type { FeedbackCategory, FeedbackThread } from '../types/domain'
import { Icon } from './Icon'

const categoryOptions: Array<{ value: FeedbackCategory; label: string }> = [
  { value: 'SUGGESTION', label: 'Sugerencia' },
  { value: 'ISSUE', label: 'Problema' },
  { value: 'QUESTION', label: 'Consulta' },
  { value: 'OTHER', label: 'Otro' },
]

export function FloatingFeedbackButton() {
  const user = useAuthStore((state) => state.user)
  const showError = useFeedbackStore((state) => state.error)
  const showSuccess = useFeedbackStore((state) => state.success)
  const [open, setOpen] = useState(false)
  const [threads, setThreads] = useState<FeedbackThread[]>([])
  const [selectedId, setSelectedId] = useState<number | null>(null)
  const [loading, setLoading] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const closeRef = useRef<HTMLButtonElement | null>(null)

  const canUseFeedback = user?.role === 'COMMERCE' || user?.role === 'DISTRIBUTOR'
  const selectedThread = useMemo(() => threads.find((thread) => thread.id === selectedId) ?? threads[0] ?? null, [selectedId, threads])

  useEffect(() => {
    if (!open) return
    closeRef.current?.focus()
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = previousOverflow
    }
  }, [open])

  useEffect(() => {
    if (!open) return
    void loadThreads()
  }, [open])

  if (!canUseFeedback) return null

  async function loadThreads(nextSelectedId?: number) {
    setLoading(true)
    try {
      const nextThreads = await api.feedbackThreads()
      setThreads(nextThreads)
      if (nextSelectedId) setSelectedId(nextSelectedId)
      else if (!selectedId && nextThreads[0]) setSelectedId(nextThreads[0].id)
    } catch (caught) {
      showError(caught instanceof Error ? caught.message : 'No pudimos cargar tus conversaciones.')
    } finally {
      setLoading(false)
    }
  }

  async function submitNewThread(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (submitting) return
    const form = new FormData(event.currentTarget)
    setSubmitting(true)
    try {
      const thread = await api.createFeedbackThread({
        subject: String(form.get('subject') ?? ''),
        category: String(form.get('category') ?? 'SUGGESTION'),
        initial_message: String(form.get('message') ?? ''),
      })
      event.currentTarget.reset()
      showSuccess('Gracias. Guardamos tu opinion.')
      await loadThreads(thread.id)
    } catch (caught) {
      showError(caught instanceof Error ? caught.message : 'No pudimos guardar tu opinion.')
    } finally {
      setSubmitting(false)
    }
  }

  async function submitReply(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!selectedThread || submitting) return
    const form = new FormData(event.currentTarget)
    const body = String(form.get('reply') ?? '').trim()
    if (!body) return
    setSubmitting(true)
    try {
      await api.replyFeedbackThread(selectedThread.id, { body })
      event.currentTarget.reset()
      await loadThreads(selectedThread.id)
      showSuccess('Respuesta enviada.')
    } catch (caught) {
      showError(caught instanceof Error ? caught.message : 'No pudimos enviar la respuesta.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <>
      <button
        className="fixed bottom-24 right-4 z-[1200] inline-flex min-h-12 items-center gap-2 rounded-full bg-slate-950 px-4 text-sm font-800 text-white shadow-[0_22px_50px_-24px_rgba(15,23,42,0.75)] transition hover:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:ring-offset-2 lg:bottom-5"
        type="button"
        onClick={() => setOpen(true)}
      >
        <Icon name="message" className="h-4 w-4" />
        Tu opinion nos importa
      </button>

      {open && (
        <div
          className="fixed inset-0 z-[1500] grid place-items-end bg-slate-950/50 p-0 sm:place-items-center sm:p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="feedback-thread-title"
          onClick={() => setOpen(false)}
        >
          <section
            className="max-h-dvh w-full overflow-hidden rounded-t-[1.4rem] bg-white shadow-2xl sm:max-h-[92dvh] sm:max-w-5xl sm:rounded-lg"
            onClick={(event) => event.stopPropagation()}
          >
            <header className="flex items-start justify-between gap-4 border-b border-slate-200 px-4 py-4 sm:px-5">
              <div>
                <p className="text-xs font-800 uppercase tracking-[0.16em] text-brand-700">Opinion</p>
                <h2 id="feedback-thread-title" className="mt-1 text-xl font-800 text-slate-950">Tu opinion nos importa</h2>
                <p className="mt-1 text-sm leading-6 text-slate-600">Dejanos una sugerencia o continua una conversacion con el equipo.</p>
              </div>
              <button
                ref={closeRef}
                className="inline-flex h-11 w-11 items-center justify-center rounded-md border border-slate-200 text-slate-600 transition hover:bg-slate-50"
                type="button"
                aria-label="Cerrar opinion"
                onClick={() => setOpen(false)}
              >
                <Icon name="close" className="h-5 w-5" />
              </button>
            </header>

            <div className="grid max-h-[calc(100dvh-8rem)] overflow-y-auto sm:max-h-[calc(92dvh-5rem)] lg:grid-cols-[20rem_1fr]">
              <aside className="border-b border-slate-200 p-4 lg:border-b-0 lg:border-r">
                <form className="grid gap-3" onSubmit={submitNewThread}>
                  <label className="grid gap-1 text-sm font-700 text-slate-700">
                    Asunto
                    <input className="min-h-11 rounded-md border border-slate-300 px-3" name="subject" maxLength={160} required />
                  </label>
                  <label className="grid gap-1 text-sm font-700 text-slate-700">
                    Tipo
                    <select className="min-h-11 rounded-md border border-slate-300 px-3" name="category" defaultValue="SUGGESTION">
                      {categoryOptions.map((option) => (
                        <option key={option.value} value={option.value}>{option.label}</option>
                      ))}
                    </select>
                  </label>
                  <label className="grid gap-1 text-sm font-700 text-slate-700">
                    Mensaje
                    <textarea className="min-h-28 rounded-md border border-slate-300 px-3 py-2" name="message" required />
                  </label>
                  <button className="min-h-11 rounded-md bg-brand-600 px-4 text-sm font-800 text-white transition hover:bg-brand-700 disabled:opacity-60" type="submit" disabled={submitting}>
                    {submitting ? 'Enviando...' : 'Enviar opinion'}
                  </button>
                </form>

                <div className="mt-5 grid gap-2">
                  <p className="text-xs font-800 uppercase tracking-[0.16em] text-slate-500">Conversaciones</p>
                  {loading ? <p className="text-sm font-700 text-slate-500">Cargando...</p> : null}
                  {!loading && threads.length === 0 ? <p className="text-sm leading-6 text-slate-600">Todavia no abriste conversaciones.</p> : null}
                  {threads.map((thread) => (
                    <button
                      key={thread.id}
                      className={`rounded-md border px-3 py-2 text-left text-sm transition ${selectedThread?.id === thread.id ? 'border-brand-400 bg-brand-50 text-brand-800' : 'border-slate-200 text-slate-700 hover:bg-slate-50'}`}
                      type="button"
                      onClick={() => setSelectedId(thread.id)}
                    >
                      <span className="block font-800">{thread.subject}</span>
                      <span className="mt-1 block text-xs font-700 uppercase text-slate-500">{statusLabel(thread.status)}</span>
                    </button>
                  ))}
                </div>
              </aside>

              <div className="grid min-h-[24rem] content-between gap-4 p-4 sm:p-5">
                {selectedThread ? (
                  <>
                    <div>
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                          <h3 className="text-lg font-800 text-slate-950">{selectedThread.subject}</h3>
                          <p className="mt-1 text-xs font-800 uppercase text-slate-500">{categoryLabel(selectedThread.category)} - {statusLabel(selectedThread.status)}</p>
                        </div>
                      </div>
                      <div className="mt-4 grid gap-3">
                        {selectedThread.messages.map((message) => (
                          <article key={message.id} className={`max-w-[38rem] rounded-lg border p-3 ${message.is_staff_reply ? 'justify-self-start border-brand-200 bg-brand-50' : 'justify-self-end border-slate-200 bg-slate-50'}`}>
                            <p className="text-xs font-800 uppercase text-slate-500">{message.is_staff_reply ? 'DistroMaxi' : message.author_name}</p>
                            <p className="mt-2 whitespace-pre-line text-sm leading-6 text-slate-800">{message.body}</p>
                          </article>
                        ))}
                      </div>
                    </div>
                    {selectedThread.status !== 'CLOSED' ? (
                      <form className="grid gap-2 border-t border-slate-200 pt-4" onSubmit={submitReply}>
                        <label className="grid gap-1 text-sm font-700 text-slate-700">
                          Responder
                          <textarea className="min-h-24 rounded-md border border-slate-300 px-3 py-2" name="reply" required />
                        </label>
                        <button className="min-h-11 w-fit rounded-md bg-slate-950 px-4 text-sm font-800 text-white transition hover:bg-slate-800 disabled:opacity-60" type="submit" disabled={submitting}>
                          {submitting ? 'Enviando...' : 'Enviar respuesta'}
                        </button>
                      </form>
                    ) : (
                      <p className="rounded-md border border-slate-200 bg-slate-50 p-3 text-sm font-700 text-slate-600">Este hilo esta cerrado.</p>
                    )}
                  </>
                ) : (
                  <div className="grid place-items-center rounded-lg border border-dashed border-slate-300 p-8 text-center">
                    <p className="text-sm font-700 text-slate-600">Crea tu primer mensaje para abrir una conversacion.</p>
                  </div>
                )}
              </div>
            </div>
          </section>
        </div>
      )}
    </>
  )
}

function statusLabel(status: FeedbackThread['status']) {
  if (status === 'ANSWERED') return 'Respondido'
  if (status === 'CLOSED') return 'Cerrado'
  return 'Abierto'
}

function categoryLabel(category: FeedbackThread['category']) {
  return categoryOptions.find((option) => option.value === category)?.label ?? 'Otro'
}
