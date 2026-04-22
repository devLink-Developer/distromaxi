import { useEffect, useMemo, useState } from 'react'
import type { FormEvent } from 'react'

import { api } from '../services/api'
import { EmptyState } from './EmptyState'

export type FieldConfig = {
  name: string
  label: string
  type?: 'text' | 'number' | 'email' | 'date' | 'time' | 'url' | 'textarea' | 'select' | 'checkbox'
  required?: boolean
  options?: Array<{ value: string; label: string }>
  helperText?: string
  defaultValue?: string | number | boolean
}

type Row = Record<string, unknown> & { id: number }
type ColumnConfig = {
  key: string
  label: string
  format?: (value: unknown, row: Row) => string
}

export function ResourceManager({
  title,
  description,
  endpoint,
  fields,
  columns,
  createLabel = 'Agregar',
  allowCreate = true,
  allowDelete = true,
  onSaved,
}: {
  title: string
  description: string
  endpoint: string
  fields: FieldConfig[]
  columns: ColumnConfig[]
  createLabel?: string
  allowCreate?: boolean
  allowDelete?: boolean
  onSaved?: () => void | Promise<void>
}) {
  const [rows, setRows] = useState<Row[]>([])
  const [editing, setEditing] = useState<Row | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const initialValues = useMemo(
    () => Object.fromEntries(fields.map((field) => [field.name, editing ? (editing[field.name] ?? '') : (field.defaultValue ?? '')])),
    [editing, fields],
  )

  async function load() {
    setLoading(true)
    setError('')
    try {
      const data = await api.list<Row>(endpoint)
      setRows(data)
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'No pudimos cargar la informacion.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void load()
  }, [endpoint])

  function openCreate() {
    setEditing(null)
    setError('')
    setShowForm(true)
  }

  function openEdit(row: Row) {
    setEditing(row)
    setError('')
    setShowForm(true)
  }

  function closeForm() {
    setShowForm(false)
    setEditing(null)
    setError('')
  }

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError('')
    const formElement = event.currentTarget
    const form = new FormData(formElement)
    const entries: Array<[string, FormDataEntryValue | boolean | null]> = []
    fields.forEach((field) => {
      if (field.type === 'checkbox') {
        entries.push([field.name, form.has(field.name)])
        return
      }
      const value = form.get(field.name) ?? ''
      if (value === '' && field.type === 'date') {
        entries.push([field.name, null])
        return
      }
      if (value === '' && field.type === 'number' && !field.required) return
      entries.push([field.name, value])
    })
    const body = Object.fromEntries(entries)
    try {
      if (editing) {
        await api.update<Row>(endpoint, editing.id, body)
      } else {
        await api.create<Row>(endpoint, body)
      }
      formElement.reset()
      closeForm()
      await load()
      await onSaved?.()
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'No pudimos guardar los cambios.')
    }
  }

  async function onDelete(row: Row) {
    const confirmed = window.confirm('Eliminar este dato?')
    if (!confirmed) return
    await api.remove(endpoint, row.id)
    await load()
    await onSaved?.()
  }

  return (
    <section className="grid gap-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-800 text-slate-950">{title}</h1>
          {description && <p className="mt-1 max-w-2xl text-sm leading-6 text-slate-600">{description}</p>}
        </div>
        {allowCreate && (
          <button
            className="inline-flex min-h-11 items-center justify-center rounded-md bg-brand-600 px-4 text-sm font-800 text-white transition hover:bg-brand-700"
            type="button"
            onClick={openCreate}
          >
            {createLabel}
          </button>
        )}
      </div>

      {error && !showForm && <p className="rounded-md bg-red-50 px-3 py-2 text-sm font-700 text-red-700">{error}</p>}

      {loading ? (
        <div className="rounded-lg border border-slate-200 bg-white p-6 text-sm font-700 text-slate-600">Cargando informacion...</div>
      ) : rows.length === 0 ? (
        <EmptyState title="Todavia no hay datos" text="Usa el boton Agregar para cargar el primero." />
      ) : (
        <div className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-soft">
          <div className="hidden overflow-x-auto md:block">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-100 text-xs font-800 uppercase text-slate-500">
                <tr>
                  {columns.map((column) => (
                    <th key={column.key} className="px-4 py-3">
                      {column.label}
                    </th>
                  ))}
                  <th className="px-4 py-3">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {rows.map((row) => (
                  <tr key={row.id}>
                    {columns.map((column) => (
                      <td key={column.key} className="px-4 py-3 font-600 text-slate-700">
                        {formatColumn(column, row)}
                      </td>
                    ))}
                    <td className="px-4 py-3">
                      <RowActions row={row} onEdit={openEdit} onDelete={onDelete} allowDelete={allowDelete} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="grid gap-3 p-3 md:hidden">
            {rows.map((row) => (
              <article key={row.id} className="rounded-lg border border-slate-200 p-3">
                {columns.map((column) => (
                  <p key={column.key} className="text-sm text-slate-600">
                    <span className="font-800 text-slate-950">{column.label}:</span> {formatColumn(column, row)}
                  </p>
                ))}
                <div className="mt-3">
                  <RowActions row={row} onEdit={openEdit} onDelete={onDelete} allowDelete={allowDelete} />
                </div>
              </article>
            ))}
          </div>
        </div>
      )}

      {showForm && (
        <div
          className="fixed inset-0 z-50 grid place-items-end bg-slate-950/50 p-0 sm:place-items-center sm:p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="resource-form-title"
        >
          <div className="max-h-[92dvh] w-full overflow-y-auto rounded-t-lg bg-white p-4 shadow-soft sm:max-w-3xl sm:rounded-lg sm:p-5">
            <div className="flex items-start justify-between gap-4 border-b border-slate-200 pb-4">
              <h2 id="resource-form-title" className="text-xl font-800 text-slate-950">
                {editing ? `Editar ${title.toLowerCase()}` : `Agregar ${title.toLowerCase()}`}
              </h2>
              <button
                className="min-h-11 rounded-md border border-slate-300 px-3 text-sm font-800 text-slate-700"
                type="button"
                onClick={closeForm}
              >
                Cerrar
              </button>
            </div>
            <form className="mt-4 grid gap-4" onSubmit={onSubmit}>
              <div className="grid gap-4 md:grid-cols-2">
                {fields.map((field) => (
                  <ResourceField key={`${field.name}-${String(initialValues[field.name])}`} field={field} value={initialValues[field.name]} />
                ))}
              </div>
              {error && <p className="rounded-md bg-red-50 px-3 py-2 text-sm font-700 text-red-700">{error}</p>}
              <div className="flex flex-wrap justify-end gap-3 border-t border-slate-200 pt-4">
                <button
                  className="min-h-11 rounded-md border border-slate-300 px-4 text-sm font-800 text-slate-700"
                  type="button"
                  onClick={closeForm}
                >
                  Cancelar
                </button>
                <button className="min-h-11 rounded-md bg-brand-600 px-4 text-sm font-800 text-white" type="submit">
                  {editing ? 'Guardar cambios' : 'Guardar'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </section>
  )
}

function ResourceField({ field, value }: { field: FieldConfig; value: unknown }) {
  if (field.type === 'checkbox') {
    return (
      <label className="flex min-h-11 items-center gap-3 rounded-md border border-slate-200 px-3 text-sm font-700 text-slate-700">
        <input
          className="h-4 w-4 rounded border-slate-300 text-brand-600"
          name={field.name}
          type="checkbox"
          defaultChecked={Boolean(value)}
        />
        <span>{field.label}</span>
      </label>
    )
  }

  return (
    <label className="grid gap-1 text-sm font-700 text-slate-700">
      {field.label}
      {field.type === 'textarea' ? (
        <textarea
          className="min-h-24 rounded-md border border-slate-300 px-3 py-2 font-500 text-slate-950"
          name={field.name}
          defaultValue={String(value ?? '')}
          required={field.required}
        />
      ) : field.type === 'select' ? (
        <select
          className="min-h-11 rounded-md border border-slate-300 px-3 font-500 text-slate-950"
          name={field.name}
          defaultValue={String(value ?? '')}
          required={field.required}
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
          className="min-h-11 rounded-md border border-slate-300 px-3 font-500 text-slate-950"
          name={field.name}
          type={field.type ?? 'text'}
          inputMode={field.type === 'number' ? 'decimal' : undefined}
          step={field.type === 'number' ? 'any' : undefined}
          defaultValue={String(value ?? '')}
          required={field.required}
        />
      )}
      {field.helperText && <span className="text-xs font-600 leading-5 text-slate-500">{field.helperText}</span>}
    </label>
  )
}

function formatColumn(column: ColumnConfig, row: Row) {
  const value = row[column.key]
  return column.format ? column.format(value, row) : String(value ?? '')
}

function RowActions({
  row,
  onEdit,
  onDelete,
  allowDelete,
}: {
  row: Row
  onEdit: (row: Row) => void
  onDelete: (row: Row) => Promise<void>
  allowDelete: boolean
}) {
  return (
    <div className="flex flex-wrap gap-2">
      <button
        className="min-h-10 rounded-md border border-brand-200 px-3 text-xs font-800 text-brand-700"
        type="button"
        onClick={() => onEdit(row)}
      >
        Editar
      </button>
      {allowDelete && (
        <button
          className="min-h-10 rounded-md border border-red-200 px-3 text-xs font-800 text-red-700"
          type="button"
          onClick={() => void onDelete(row)}
        >
          Eliminar
        </button>
      )}
    </div>
  )
}
