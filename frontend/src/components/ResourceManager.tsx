import { useEffect, useId, useMemo, useState } from 'react'
import type { FormEvent } from 'react'

import { api } from '../services/api'
import { useFeedbackStore } from '../stores/feedbackStore'
import { EmptyState } from './EmptyState'
import { Icon } from './Icon'

export type FieldConfig = {
  name: string
  label: string
  type?: 'text' | 'number' | 'email' | 'date' | 'time' | 'url' | 'textarea' | 'select' | 'checkbox'
  required?: boolean
  options?: Array<{ value: string; label: string }>
  helperText?: string
  defaultValue?: string | number | boolean
  placeholder?: string
  min?: number
  max?: number
  step?: number | 'any'
  span?: 'full'
}

export type ResourceRow = Record<string, unknown> & { id: number }
type ColumnConfig = {
  key: string
  label: string
  format?: (value: unknown, row: ResourceRow) => string
}
type QuickFilter = {
  id: string
  label: string
  predicate: (row: ResourceRow) => boolean
}
type SummaryItem = {
  label: string
  value: string | number
  hint?: string
  tone?: 'default' | 'success' | 'warning' | 'danger'
}
type FormSection = {
  title: string
  description?: string
  fields: string[]
}

export function ResourceManager({
  title,
  endpoint,
  fields,
  columns,
  createLabel = 'Agregar',
  allowCreate = true,
  allowDelete = true,
  onSaved,
  searchPlaceholder,
  searchKeys,
  quickFilters = [],
  summary,
  mobileColumns,
  formSections,
  emptyTitle = 'Todavia no hay datos',
  emptyText,
}: {
  title: string
  description?: string
  endpoint: string
  fields: FieldConfig[]
  columns: ColumnConfig[]
  createLabel?: string
  allowCreate?: boolean
  allowDelete?: boolean
  onSaved?: () => void | Promise<void>
  searchPlaceholder?: string
  searchKeys?: string[]
  quickFilters?: QuickFilter[]
  summary?: (rows: ResourceRow[]) => SummaryItem[]
  mobileColumns?: string[]
  formSections?: FormSection[]
  emptyTitle?: string
  emptyText?: string
}) {
  const [rows, setRows] = useState<ResourceRow[]>([])
  const [editing, setEditing] = useState<ResourceRow | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [loading, setLoading] = useState(true)
  const [errorMessage, setErrorMessage] = useState('')
  const [query, setQuery] = useState('')
  const [activeFilter, setActiveFilter] = useState('all')
  const [submitting, setSubmitting] = useState(false)
  const [deletingId, setDeletingId] = useState<number | null>(null)
  const searchInputId = useId()
  const resultStatusId = useId()
  const formTitleId = useId()
  const showSuccess = useFeedbackStore((state) => state.success)
  const showError = useFeedbackStore((state) => state.error)
  const confirm = useFeedbackStore((state) => state.confirm)

  const initialValues = useMemo(
    () => Object.fromEntries(fields.map((field) => [field.name, editing ? (editing[field.name] ?? '') : (field.defaultValue ?? '')])),
    [editing, fields],
  )
  const fieldsByName = useMemo(() => new Map(fields.map((field) => [field.name, field])), [fields])
  const resolvedFormSections = useMemo(
    () => (formSections?.length ? formSections : [{ title: 'Datos', fields: fields.map((field) => field.name) }]),
    [fields, formSections],
  )
  const searchColumnKeys = searchKeys?.length ? searchKeys : columns.map((column) => column.key)
  const selectedQuickFilter = quickFilters.find((filter) => filter.id === activeFilter)
  const summaryItems = summary?.(rows) ?? []

  async function load() {
    setLoading(true)
    setErrorMessage('')
    try {
      const data = await api.list<ResourceRow>(endpoint)
      setRows(data)
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : 'No pudimos cargar la informacion.'
      setErrorMessage(message)
      showError(message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void load()
  }, [endpoint])

  useEffect(() => {
    if (!showForm) return undefined

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') closeForm()
    }

    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [showForm])

  const normalizedQuery = query.trim().toLocaleLowerCase('es-AR')
  const filteredRows = useMemo(() => {
    return rows.filter((row) => {
      if (selectedQuickFilter && !selectedQuickFilter.predicate(row)) return false
      if (!normalizedQuery) return true

      return searchColumnKeys.some((key) => String(row[key] ?? '').toLocaleLowerCase('es-AR').includes(normalizedQuery))
    })
  }, [normalizedQuery, rows, searchColumnKeys, selectedQuickFilter])

  const hasRows = rows.length > 0
  const hasFilteredRows = filteredRows.length > 0
  const isFiltered = normalizedQuery.length > 0 || activeFilter !== 'all'
  const visibleColumns = columns.length > 0 ? columns : [{ key: 'id', label: 'ID' }]
  const mobileColumnSet = mobileColumns?.length ? new Set(mobileColumns) : null
  const visibleMobileColumns = mobileColumnSet ? visibleColumns.filter((column) => mobileColumnSet.has(column.key)) : visibleColumns.slice(0, 5)
  const resultText = isFiltered
    ? `${filteredRows.length} de ${rows.length} ${rows.length === 1 ? 'registro' : 'registros'}`
    : `${rows.length} ${rows.length === 1 ? 'registro' : 'registros'}`

  function openCreate() {
    setEditing(null)
    setShowForm(true)
  }

  function openEdit(row: ResourceRow) {
    setEditing(row)
    setShowForm(true)
  }

  function closeForm() {
    setShowForm(false)
    setEditing(null)
  }

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (submitting) return
    const formElement = event.currentTarget
    const form = new FormData(formElement)
    const entries: Array<[string, FormDataEntryValue | boolean | null]> = []
    fields.forEach((field) => {
      if (field.type === 'checkbox') {
        entries.push([field.name, form.has(field.name)])
        return
      }
      const value = form.get(field.name) ?? ''
      if (value === '' && (field.type === 'date' || field.type === 'time')) {
        entries.push([field.name, null])
        return
      }
      if (value === '' && field.type === 'number' && !field.required) return
      entries.push([field.name, value])
    })
    const body = Object.fromEntries(entries)
    setSubmitting(true)
    try {
      if (editing) {
        await api.update<ResourceRow>(endpoint, editing.id, body)
      } else {
        await api.create<ResourceRow>(endpoint, body)
      }
      formElement.reset()
      closeForm()
      await load()
      await onSaved?.()
      showSuccess(editing ? 'Cambios guardados.' : 'Dato guardado.')
    } catch (caught) {
      showError(caught instanceof Error ? caught.message : 'No pudimos guardar los cambios.')
    } finally {
      setSubmitting(false)
    }
  }

  async function onDelete(row: ResourceRow) {
    if (deletingId !== null) return
    const confirmed = await confirm({
      title: 'Eliminar registro',
      message: 'Esta accion elimina el dato cargado.',
      confirmLabel: 'Eliminar',
      cancelLabel: 'Cancelar',
      tone: 'danger',
    })
    if (!confirmed) return
    setDeletingId(row.id)
    try {
      await api.remove(endpoint, row.id)
      await load()
      await onSaved?.()
      showSuccess('Dato eliminado.')
    } catch (caught) {
      showError(caught instanceof Error ? caught.message : 'No pudimos eliminar el dato.')
    } finally {
      setDeletingId(null)
    }
  }

  return (
    <section className="grid gap-4">
      <div className="grid gap-4 rounded-lg border border-slate-200 bg-white p-4 shadow-soft">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <h1 className="text-2xl font-800 text-slate-950">{title}</h1>
          </div>
          {allowCreate && (
            <button
              className="inline-flex min-h-11 w-full items-center justify-center rounded-md bg-brand-600 px-4 text-sm font-800 text-white transition hover:bg-brand-700 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto"
              type="button"
              onClick={openCreate}
              disabled={loading}
            >
              {createLabel}
            </button>
          )}
        </div>

        <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end">
          <label className="grid gap-1 text-sm font-800 text-slate-700" htmlFor={searchInputId}>
            Buscar
            <span className="relative">
              <Icon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" name="search" />
              <input
                id={searchInputId}
                className="min-h-11 w-full rounded-md border border-slate-300 bg-white py-2 pl-10 pr-3 text-base font-600 text-slate-950 outline-none transition placeholder:text-slate-400 focus:border-brand-500 focus:ring-2 focus:ring-brand-100 sm:text-sm"
                type="search"
                placeholder={searchPlaceholder ?? `Buscar en ${title.toLowerCase()}`}
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                aria-describedby={resultStatusId}
                disabled={loading || (!hasRows && !isFiltered)}
              />
            </span>
          </label>
          <div className="flex items-center justify-between gap-3 sm:justify-end">
            <p id={resultStatusId} className="text-sm font-800 text-slate-600" aria-live="polite">
              {loading ? 'Cargando...' : resultText}
            </p>
            {isFiltered && (
              <button
                className="min-h-11 rounded-md border border-slate-300 px-3 text-sm font-800 text-slate-700 transition hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:ring-offset-2"
                type="button"
                onClick={() => {
                  setQuery('')
                  setActiveFilter('all')
                }}
              >
                Limpiar
              </button>
            )}
          </div>
        </div>

        {quickFilters.length > 0 && (
          <div className="flex flex-wrap gap-2" role="group" aria-label={`Filtros de ${title.toLowerCase()}`}>
            <FilterButton active={activeFilter === 'all'} label="Todos" count={rows.length} onClick={() => setActiveFilter('all')} />
            {quickFilters.map((filter) => (
              <FilterButton
                key={filter.id}
                active={activeFilter === filter.id}
                label={filter.label}
                count={rows.filter(filter.predicate).length}
                onClick={() => setActiveFilter(filter.id)}
              />
            ))}
          </div>
        )}
      </div>

      {!loading && summaryItems.length > 0 && (
        <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
          {summaryItems.map((item) => (
            <article key={item.label} className={`rounded-lg border bg-white p-3 shadow-soft ${summaryToneClass(item.tone)}`}>
              <p className="text-[11px] font-800 uppercase text-slate-500">{item.label}</p>
              <strong className="mt-1 block text-lg font-800 text-slate-950">{item.value}</strong>
              {item.hint && <p className="mt-1 text-xs font-700 text-slate-500">{item.hint}</p>}
            </article>
          ))}
        </div>
      )}

      {errorMessage && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4" role="alert">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-sm font-800 text-red-950">No pudimos cargar los datos</h2>
              <p className="mt-1 text-sm leading-6 text-red-800">{errorMessage}</p>
            </div>
            <button
              className="inline-flex min-h-11 items-center justify-center rounded-md border border-red-300 bg-white px-4 text-sm font-800 text-red-700 transition hover:bg-red-100 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60"
              type="button"
              onClick={() => void load()}
              disabled={loading}
            >
              Reintentar
            </button>
          </div>
        </div>
      )}

      {loading ? (
        <LoadingState />
      ) : errorMessage && !hasRows ? null : !hasRows ? (
        <EmptyState title={emptyTitle} text={emptyText} />
      ) : isFiltered && !hasFilteredRows ? (
        <EmptyState title="Sin resultados" />
      ) : (
        <div className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-soft">
          <div className="hidden overflow-x-auto md:block">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-100 text-xs font-800 uppercase text-slate-500">
                <tr>
                  {visibleColumns.map((column) => (
                    <th key={column.key} className="px-4 py-3">
                      {column.label}
                    </th>
                  ))}
                  <th className="px-4 py-3">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredRows.map((row) => (
                  <tr key={row.id} className="align-top transition hover:bg-slate-50">
                    {visibleColumns.map((column) => (
                      <td key={column.key} className="max-w-[18rem] px-4 py-3 font-600 text-slate-700">
                        {formatColumn(column, row)}
                      </td>
                    ))}
                    <td className="px-4 py-3">
                      <RowActions row={row} onEdit={openEdit} onDelete={onDelete} allowDelete={allowDelete} deleting={deletingId === row.id} disabled={deletingId !== null || loading} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="grid gap-3 p-3 md:hidden">
            {filteredRows.map((row) => (
              <article key={row.id} className="rounded-lg border border-slate-200 p-3">
                <dl className="grid gap-2">
                  {visibleMobileColumns.map((column) => (
                    <div key={column.key} className="grid gap-0.5">
                      <dt className="text-[11px] font-800 uppercase text-slate-500">{column.label}</dt>
                      <dd className="break-words text-sm font-700 leading-6 text-slate-900">{formatColumn(column, row)}</dd>
                    </div>
                  ))}
                </dl>
                <div className="mt-3">
                  <RowActions row={row} onEdit={openEdit} onDelete={onDelete} allowDelete={allowDelete} deleting={deletingId === row.id} disabled={deletingId !== null || loading} />
                </div>
              </article>
            ))}
          </div>
        </div>
      )}

      {showForm && (
        <div
          className="fixed inset-0 z-[1300] grid place-items-end bg-slate-950/50 p-0 sm:place-items-center sm:p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby={formTitleId}
        >
          <div className="max-h-dvh w-full overflow-y-auto rounded-t-lg bg-white p-4 shadow-soft sm:max-h-[92dvh] sm:max-w-3xl sm:rounded-lg sm:p-5">
            <div className="flex items-start justify-between gap-4 border-b border-slate-200 pb-4">
              <div className="min-w-0">
                <h2 id={formTitleId} className="text-xl font-800 text-slate-950">
                  {editing ? `Editar ${title.toLowerCase()}` : `Agregar ${title.toLowerCase()}`}
                </h2>
              </div>
              <button
                className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-md border border-slate-300 px-3 text-sm font-800 text-slate-700 transition hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60"
                type="button"
                onClick={closeForm}
                disabled={submitting}
                aria-label="Cerrar formulario"
              >
                <Icon name="close" />
              </button>
            </div>
            <form className="mt-4 grid gap-4" onSubmit={onSubmit} aria-busy={submitting}>
              {resolvedFormSections.map((section) => {
                const sectionFields = section.fields.map((fieldName) => fieldsByName.get(fieldName)).filter(Boolean) as FieldConfig[]
                if (sectionFields.length === 0) return null

                return (
                  <fieldset key={section.title} className="rounded-lg border border-slate-200 p-3">
                    <legend className="px-1 text-sm font-800 text-slate-950">{section.title}</legend>
                    <div className="grid gap-3 md:grid-cols-2">
                      {sectionFields.map((field) => (
                        <ResourceField key={`${field.name}-${String(initialValues[field.name])}`} field={field} value={initialValues[field.name]} />
                      ))}
                    </div>
                  </fieldset>
                )
              })}
              <div className="sticky bottom-0 -mx-4 flex flex-col-reverse gap-3 border-t border-slate-200 bg-white px-4 pt-4 sm:-mx-5 sm:flex-row sm:justify-end sm:px-5">
                <button
                  className="min-h-11 rounded-md border border-slate-300 px-4 text-sm font-800 text-slate-700 transition hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60"
                  type="button"
                  onClick={closeForm}
                  disabled={submitting}
                >
                  Cancelar
                </button>
                <button
                  className="min-h-11 rounded-md bg-brand-600 px-4 text-sm font-800 text-white transition hover:bg-brand-700 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60"
                  type="submit"
                  disabled={submitting}
                >
                  {submitting ? 'Guardando...' : editing ? 'Guardar cambios' : 'Guardar'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </section>
  )
}

function LoadingState() {
  return (
    <div className="grid gap-3 rounded-lg border border-slate-200 bg-white p-4 shadow-soft" aria-live="polite" aria-busy="true">
      <div className="h-4 w-36 rounded bg-slate-200" />
      <div className="grid gap-2">
        <div className="h-10 rounded bg-slate-100" />
        <div className="h-10 rounded bg-slate-100" />
        <div className="h-10 rounded bg-slate-100" />
      </div>
      <span className="sr-only">Cargando informacion...</span>
    </div>
  )
}

function ResourceField({ field, value }: { field: FieldConfig; value: unknown }) {
  const fieldId = useId()
  const helperId = useId()
  const fieldClassName =
    field.span === 'full' || field.type === 'textarea'
      ? 'grid gap-1 text-sm font-700 text-slate-700 md:col-span-2'
      : 'grid gap-1 text-sm font-700 text-slate-700'

  if (field.type === 'checkbox') {
    return (
      <label className="flex min-h-11 items-start gap-3 rounded-md border border-slate-200 px-3 py-3 text-sm font-700 text-slate-700 transition focus-within:border-brand-500 focus-within:ring-2 focus-within:ring-brand-100">
        <input
          id={fieldId}
          className="mt-0.5 h-4 w-4 rounded border-slate-300 text-brand-600 focus:ring-brand-500"
          name={field.name}
          type="checkbox"
          defaultChecked={Boolean(value)}
          aria-describedby={field.helperText ? helperId : undefined}
        />
        <span className="grid gap-1">
          <span>
            {field.label}
            {field.required && <span className="text-red-600" aria-hidden="true"> *</span>}
          </span>
          {field.helperText && <span id={helperId} className="text-xs font-600 leading-5 text-slate-500">{field.helperText}</span>}
        </span>
      </label>
    )
  }

  return (
    <label className={fieldClassName} htmlFor={fieldId}>
      <span>
        {field.label}
        {field.required && <span className="text-red-600" aria-hidden="true"> *</span>}
      </span>
      {field.type === 'textarea' ? (
        <textarea
          id={fieldId}
          className="min-h-24 rounded-md border border-slate-300 px-3 py-2 text-base font-500 text-slate-950 outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-100 sm:text-sm"
          name={field.name}
          defaultValue={String(value ?? '')}
          placeholder={field.placeholder}
          required={field.required}
          aria-describedby={field.helperText ? helperId : undefined}
        />
      ) : field.type === 'select' ? (
        <select
          id={fieldId}
          className="min-h-11 rounded-md border border-slate-300 px-3 text-base font-500 text-slate-950 outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-100 sm:text-sm"
          name={field.name}
          defaultValue={String(value ?? '')}
          required={field.required}
          aria-describedby={field.helperText ? helperId : undefined}
        >
          <option value="">Elegi una opcion</option>
          {(field.options ?? []).map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      ) : (
        <input
          id={fieldId}
          className="min-h-11 rounded-md border border-slate-300 px-3 text-base font-500 text-slate-950 outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-100 sm:text-sm"
          name={field.name}
          type={field.type ?? 'text'}
          inputMode={field.type === 'number' ? 'decimal' : undefined}
          step={field.type === 'number' ? (field.step ?? 'any') : undefined}
          min={field.type === 'number' ? field.min : undefined}
          max={field.type === 'number' ? field.max : undefined}
          defaultValue={String(value ?? '')}
          placeholder={field.placeholder}
          required={field.required}
          aria-describedby={field.helperText ? helperId : undefined}
        />
      )}
      {field.helperText && <span id={helperId} className="text-xs font-600 leading-5 text-slate-500">{field.helperText}</span>}
    </label>
  )
}

function FilterButton({ active, label, count, onClick }: { active: boolean; label: string; count: number; onClick: () => void }) {
  return (
    <button
      className={`min-h-10 rounded-md border px-3 text-xs font-800 transition focus:outline-none focus:ring-2 focus:ring-brand-500 focus:ring-offset-2 ${
        active ? 'border-brand-500 bg-brand-50 text-brand-700' : 'border-slate-200 bg-white text-slate-600 hover:border-brand-300 hover:text-brand-700'
      }`}
      type="button"
      aria-pressed={active}
      onClick={onClick}
    >
      {label} <span className="font-700 text-slate-500">{count}</span>
    </button>
  )
}

function summaryToneClass(tone: SummaryItem['tone']) {
  if (tone === 'success') return 'border-emerald-200'
  if (tone === 'warning') return 'border-amber-200'
  if (tone === 'danger') return 'border-red-200'
  return 'border-slate-200'
}

function formatColumn(column: ColumnConfig, row: ResourceRow) {
  const value = row[column.key]
  const formatted = column.format ? column.format(value, row) : value
  if (formatted === null || formatted === undefined || formatted === '') return '-'
  return String(formatted)
}

function RowActions({
  row,
  onEdit,
  onDelete,
  allowDelete,
  deleting,
  disabled,
}: {
  row: ResourceRow
  onEdit: (row: ResourceRow) => void
  onDelete: (row: ResourceRow) => Promise<void>
  allowDelete: boolean
  deleting: boolean
  disabled: boolean
}) {
  return (
    <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap">
      <button
        className="min-h-11 rounded-md border border-brand-200 px-3 text-sm font-800 text-brand-700 transition hover:bg-brand-50 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60 sm:min-h-10 sm:text-xs"
        type="button"
        onClick={() => onEdit(row)}
        disabled={disabled}
      >
        Editar
      </button>
      {allowDelete && (
        <button
          className="min-h-11 rounded-md border border-red-200 px-3 text-sm font-800 text-red-700 transition hover:bg-red-50 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60 sm:min-h-10 sm:text-xs"
          type="button"
          onClick={() => void onDelete(row)}
          disabled={disabled}
        >
          {deleting ? 'Eliminando...' : 'Eliminar'}
        </button>
      )}
    </div>
  )
}
