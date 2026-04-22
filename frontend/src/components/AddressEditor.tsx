import { useEffect, useState } from 'react'
import type { ReactNode } from 'react'

import { api } from '../services/api'

export type AddressEditorValue = {
  postal_code: string
  address: string
  city: string
  province: string
  latitude: string | null
  longitude: string | null
  notes: string
}

export function AddressEditor({
  title,
  description,
  notesLabel,
  saveLabel,
  initialValue,
  saving = false,
  error = '',
  message = '',
  onSave,
}: {
  title: string
  description: string
  notesLabel: string
  saveLabel: string
  initialValue: AddressEditorValue
  saving?: boolean
  error?: string
  message?: string
  onSave: (value: AddressEditorValue) => Promise<void>
}) {
  const [postalCode, setPostalCode] = useState(initialValue.postal_code)
  const [city, setCity] = useState(initialValue.city)
  const [province, setProvince] = useState(initialValue.province)
  const [locality, setLocality] = useState(initialValue.city)
  const [localities, setLocalities] = useState<string[]>(initialValue.city ? [initialValue.city] : [])
  const split = splitAddress(initialValue.address)
  const [street, setStreet] = useState(split.street)
  const [number, setNumber] = useState(split.number)
  const [notes, setNotes] = useState(initialValue.notes)
  const [latitude, setLatitude] = useState(initialValue.latitude)
  const [longitude, setLongitude] = useState(initialValue.longitude)
  const [resolvedAddress, setResolvedAddress] = useState(initialValue.address)
  const [lookupLoading, setLookupLoading] = useState(false)
  const [geoLoading, setGeoLoading] = useState(false)
  const [localError, setLocalError] = useState('')
  const [lastLookupPostalCode, setLastLookupPostalCode] = useState(initialValue.postal_code)

  useEffect(() => {
    const currentSplit = splitAddress(initialValue.address)
    setPostalCode(initialValue.postal_code)
    setCity(initialValue.city)
    setProvince(initialValue.province)
    setLocality(initialValue.city)
    setLocalities(initialValue.city ? [initialValue.city] : [])
    setStreet(currentSplit.street)
    setNumber(currentSplit.number)
    setNotes(initialValue.notes)
    setLatitude(initialValue.latitude)
    setLongitude(initialValue.longitude)
    setResolvedAddress(initialValue.address)
    setLocalError('')
    setLastLookupPostalCode(initialValue.postal_code)
  }, [initialValue.address, initialValue.city, initialValue.latitude, initialValue.longitude, initialValue.notes, initialValue.postal_code, initialValue.province])

  function resetGeolocation() {
    setLatitude(null)
    setLongitude(null)
    setResolvedAddress('')
  }

  async function lookupPostalCode(force = false) {
    const normalized = postalCode.trim()
    if (!normalized) return
    if (!force && normalized === lastLookupPostalCode) return
    setLookupLoading(true)
    setLocalError('')
    try {
      const result = await api.lookupPostalCode(normalized)
      setPostalCode(result.postal_code)
      setCity(result.city)
      setProvince(result.province)
      setLocalities(result.localities)
      setLocality((current) => (result.localities.includes(current) ? current : result.localities[0] ?? ''))
      setLastLookupPostalCode(result.postal_code)
      resetGeolocation()
    } catch (caught) {
      setLocalError(caught instanceof Error ? caught.message : 'No pudimos cargar el codigo postal.')
      setLocalities([])
    } finally {
      setLookupLoading(false)
    }
  }

  async function geolocateAddress() {
    if (!street.trim() || !number.trim() || !province.trim() || !(locality || city).trim()) {
      setLocalError('Completa codigo postal, localidad, calle y altura antes de geolocalizar.')
      return
    }
    setGeoLoading(true)
    setLocalError('')
    try {
      const result = await api.geocodeAddress({
        street: street.trim(),
        number: number.trim(),
        locality: (locality || city).trim(),
        province: province.trim(),
      })
      setResolvedAddress(result.address)
      setCity(result.city)
      setProvince(result.province)
      setLocality(result.city)
      if (!localities.includes(result.city)) {
        setLocalities((current) => (current.includes(result.city) ? current : [result.city, ...current]))
      }
      setLatitude(String(result.latitude))
      setLongitude(String(result.longitude))
    } catch (caught) {
      resetGeolocation()
      setLocalError(caught instanceof Error ? caught.message : 'No pudimos geolocalizar la direccion.')
    } finally {
      setGeoLoading(false)
    }
  }

  async function submit() {
    if (!latitude || !longitude) {
      setLocalError('Primero debes geolocalizar la direccion.')
      return
    }
    setLocalError('')
    await onSave({
      postal_code: postalCode.trim(),
      address: resolvedAddress || `${street.trim()} ${number.trim()}`.trim(),
      city: (locality || city).trim(),
      province: province.trim(),
      latitude,
      longitude,
      notes: notes.trim(),
    })
  }

  return (
    <section className="grid gap-5 rounded-[1.75rem] border border-slate-200 bg-white p-6 shadow-soft">
      <div>
        <p className="text-sm font-800 uppercase tracking-[0.14em] text-brand-700">Direccion geolocalizada</p>
        <h2 className="mt-2 text-2xl font-800 text-slate-950">{title}</h2>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">{description}</p>
      </div>

      <div className="grid gap-4 xl:grid-cols-3">
        <StepCard number="01" title="Codigo postal" text="Carga el CP y traemos la ciudad base junto con las localidades disponibles.">
          <div className="grid gap-3">
            <label className="grid gap-1 text-sm font-700 text-slate-700">
              Codigo postal
              <div className="flex flex-col gap-2 sm:flex-row">
                <input
                  className="min-h-11 flex-1 rounded-md border border-slate-300 px-3"
                  value={postalCode}
                  onChange={(event) => {
                    setPostalCode(event.target.value)
                    setLastLookupPostalCode('')
                    setLocalities([])
                    setCity('')
                    setProvince('')
                    setLocality('')
                    resetGeolocation()
                  }}
                  onBlur={() => void lookupPostalCode()}
                />
                <button
                  className="min-h-11 rounded-md border border-brand-200 px-4 text-sm font-800 text-brand-700 disabled:opacity-60"
                  type="button"
                  disabled={lookupLoading}
                  onClick={() => void lookupPostalCode(true)}
                >
                  {lookupLoading ? 'Buscando...' : 'Buscar CP'}
                </button>
              </div>
            </label>
            <label className="grid gap-1 text-sm font-700 text-slate-700">
              Ciudad
              <input className="min-h-11 rounded-md border border-slate-200 bg-slate-50 px-3 text-slate-600" value={city} readOnly />
            </label>
            <label className="grid gap-1 text-sm font-700 text-slate-700">
              Localidad
              <select
                className="min-h-11 rounded-md border border-slate-300 px-3"
                value={locality}
                onChange={(event) => {
                  setLocality(event.target.value)
                  resetGeolocation()
                }}
              >
                {localities.length === 0 ? <option value="">Primero busca el CP</option> : null}
                {localities.map((item) => (
                  <option key={item} value={item}>
                    {item}
                  </option>
                ))}
              </select>
            </label>
            <label className="grid gap-1 text-sm font-700 text-slate-700">
              Provincia
              <input className="min-h-11 rounded-md border border-slate-200 bg-slate-50 px-3 text-slate-600" value={province} readOnly />
            </label>
          </div>
        </StepCard>

        <StepCard number="02" title="Detalle de la direccion" text="Completa calle y altura. Las indicaciones adicionales no alteran la geolocalizacion.">
          <div className="grid gap-3">
            <label className="grid gap-1 text-sm font-700 text-slate-700">
              Calle
              <input
                className="min-h-11 rounded-md border border-slate-300 px-3"
                value={street}
                onChange={(event) => {
                  setStreet(event.target.value)
                  resetGeolocation()
                }}
              />
            </label>
            <label className="grid gap-1 text-sm font-700 text-slate-700">
              Altura
              <input
                className="min-h-11 rounded-md border border-slate-300 px-3"
                value={number}
                onChange={(event) => {
                  setNumber(event.target.value)
                  resetGeolocation()
                }}
              />
            </label>
            <label className="grid gap-1 text-sm font-700 text-slate-700">
              {notesLabel}
              <textarea className="min-h-24 rounded-md border border-slate-300 px-3 py-2" value={notes} onChange={(event) => setNotes(event.target.value)} />
            </label>
          </div>
        </StepCard>

        <StepCard number="03" title="Geolocalizacion" text="Validamos la direccion contra un servicio oficial y guardamos el punto exacto para pedidos y rutas.">
          <div className="grid gap-3">
            <button
              className="min-h-11 rounded-md bg-slate-950 px-4 text-sm font-800 text-white disabled:opacity-60"
              type="button"
              disabled={geoLoading}
              onClick={() => void geolocateAddress()}
            >
              {geoLoading ? 'Geolocalizando...' : 'Geolocalizar direccion'}
            </button>
            <div className={`rounded-2xl border px-4 py-4 text-sm ${latitude && longitude ? 'border-emerald-200 bg-emerald-50 text-emerald-950' : 'border-slate-200 bg-slate-50 text-slate-600'}`}>
              {latitude && longitude ? (
                <div className="grid gap-2">
                  <p className="font-800">Direccion lista para operar.</p>
                  <p>{resolvedAddress}</p>
                  <p className="text-xs font-700 uppercase tracking-[0.14em]">
                    lat {latitude} · lon {longitude}
                  </p>
                </div>
              ) : (
                <p>Aun no hay coordenadas confirmadas para esta direccion.</p>
              )}
            </div>
          </div>
        </StepCard>
      </div>

      {(localError || error) && <p className="rounded-md bg-red-50 px-3 py-2 text-sm font-700 text-red-700">{localError || error}</p>}
      {message && <p className="rounded-md bg-brand-50 px-3 py-2 text-sm font-700 text-brand-700">{message}</p>}

      <div className="flex justify-end">
        <button className="min-h-11 rounded-full bg-brand-600 px-5 text-sm font-800 text-white transition hover:bg-brand-700 disabled:opacity-60" disabled={saving || geoLoading || lookupLoading} type="button" onClick={() => void submit()}>
          {saving ? 'Guardando...' : saveLabel}
        </button>
      </div>
    </section>
  )
}

function StepCard({ number, title, text, children }: { number: string; title: string; text: string; children: ReactNode }) {
  return (
    <article className="grid gap-4 rounded-[1.5rem] border border-slate-200 bg-slate-50 p-4">
      <div>
        <p className="text-xs font-800 uppercase tracking-[0.18em] text-slate-500">Paso {number}</p>
        <h3 className="mt-2 text-lg font-800 text-slate-950">{title}</h3>
        <p className="mt-2 text-sm leading-6 text-slate-600">{text}</p>
      </div>
      {children}
    </article>
  )
}

function splitAddress(value: string) {
  const firstChunk = String(value ?? '')
    .split(',')[0]
    .trim()
  const match = firstChunk.match(/^(.+?)\s+(\d+[A-Za-z0-9/-]*)$/)
  if (!match) {
    return { street: firstChunk, number: '' }
  }
  return { street: match[1], number: match[2] }
}
