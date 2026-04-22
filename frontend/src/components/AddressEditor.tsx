import { useEffect, useRef, useState } from 'react'
import type { ReactNode } from 'react'

import { AddressMap } from './AddressMap'
import { api } from '../services/api'
import { useFeedbackStore } from '../stores/feedbackStore'

export type AddressEditorValue = {
  postal_code: string
  address: string
  city: string
  province: string
  latitude: string | null
  longitude: string | null
  notes: string
}

type GeocodeStatus = 'idle' | 'stale' | 'geocoding' | 'reverse' | 'ready'

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
  const split = splitAddress(initialValue.address)
  const [postalCode, setPostalCode] = useState(initialValue.postal_code)
  const [locality, setLocality] = useState(initialValue.city)
  const [localities, setLocalities] = useState<string[]>(initialValue.city ? [initialValue.city] : [])
  const [city, setCity] = useState(initialValue.city)
  const [province, setProvince] = useState(initialValue.province)
  const [street, setStreet] = useState(split.street)
  const [number, setNumber] = useState(split.number)
  const [notes, setNotes] = useState(initialValue.notes)
  const [latitude, setLatitude] = useState(initialValue.latitude)
  const [longitude, setLongitude] = useState(initialValue.longitude)
  const [resolvedAddress, setResolvedAddress] = useState(initialValue.address)
  const [mapPosition, setMapPosition] = useState(() => toMapPoint(initialValue.latitude, initialValue.longitude))
  const [lookupLoading, setLookupLoading] = useState(false)
  const [geoLoading, setGeoLoading] = useState(false)
  const [reverseLoading, setReverseLoading] = useState(false)
  const [localError, setLocalError] = useState('')
  const [lastLookupPostalCode, setLastLookupPostalCode] = useState(initialValue.postal_code)
  const [lastAutoGeocodeQuery, setLastAutoGeocodeQuery] = useState(
    initialValue.latitude && initialValue.longitude ? buildAutoGeocodeKey(split.street, split.number, initialValue.city, initialValue.province) : '',
  )
  const [geocodeStatus, setGeocodeStatus] = useState<GeocodeStatus>(initialValue.latitude && initialValue.longitude ? 'ready' : 'idle')
  const geocodeRequestRef = useRef(0)
  const reverseRequestRef = useRef(0)
  const showSuccess = useFeedbackStore((state) => state.success)
  const showError = useFeedbackStore((state) => state.error)

  useEffect(() => {
    const currentSplit = splitAddress(initialValue.address)
    const currentMapPosition = toMapPoint(initialValue.latitude, initialValue.longitude)
    setPostalCode(initialValue.postal_code)
    setLocality(initialValue.city)
    setLocalities(initialValue.city ? [initialValue.city] : [])
    setCity(initialValue.city)
    setProvince(initialValue.province)
    setStreet(currentSplit.street)
    setNumber(currentSplit.number)
    setNotes(initialValue.notes)
    setLatitude(initialValue.latitude)
    setLongitude(initialValue.longitude)
    setResolvedAddress(initialValue.address)
    setMapPosition(currentMapPosition)
    setLookupLoading(false)
    setGeoLoading(false)
    setReverseLoading(false)
    setLocalError('')
    setLastLookupPostalCode(initialValue.postal_code)
    setLastAutoGeocodeQuery(
      currentMapPosition ? buildAutoGeocodeKey(currentSplit.street, currentSplit.number, initialValue.city, initialValue.province) : '',
    )
    setGeocodeStatus(currentMapPosition ? 'ready' : 'idle')
  }, [initialValue.address, initialValue.city, initialValue.latitude, initialValue.longitude, initialValue.notes, initialValue.postal_code, initialValue.province])

  useEffect(() => {
    if (localError) showError(localError)
  }, [localError, showError])

  useEffect(() => {
    if (error) showError(error)
  }, [error, showError])

  useEffect(() => {
    if (message) showSuccess(message)
  }, [message, showSuccess])

  function markAddressDirty() {
    setLatitude(null)
    setLongitude(null)
    setResolvedAddress('')
    setMapPosition(null)
    setGeocodeStatus('stale')
    setLastAutoGeocodeQuery('')
    setLocalError('')
  }

  async function lookupPostalCode(force = false) {
    const normalized = postalCode.trim()
    if (!normalized) return
    if (!force && normalized === lastLookupPostalCode) return

    setLookupLoading(true)
    setLocalError('')
    try {
      const result = await api.lookupPostalCode(normalized)
      const nextLocality = result.localities.includes(locality) ? locality : result.localities[0] ?? ''
      setPostalCode(result.postal_code)
      setLocality(nextLocality)
      setLocalities(result.localities)
      setCity(nextLocality || result.city)
      setProvince(result.province)
      setLastLookupPostalCode(result.postal_code)
      markAddressDirty()
    } catch (caught) {
      setLocalError(caught instanceof Error ? caught.message : 'No pudimos cargar el codigo postal.')
      setLocalities([])
    } finally {
      setLookupLoading(false)
    }
  }

  async function geolocateAddress(mode: 'auto' | 'manual') {
    const nextStreet = street.trim()
    const nextNumber = number.trim()
    const nextLocality = (locality || city).trim()
    const nextProvince = province.trim()
    const autoGeocodeKey = buildAutoGeocodeKey(nextStreet, nextNumber, nextLocality, nextProvince)

    if (!autoGeocodeKey) {
      if (mode === 'manual') setLocalError('Completa localidad, calle y altura.')
      return
    }
    if (mode === 'auto' && autoGeocodeKey === lastAutoGeocodeQuery) return

    const currentRequest = geocodeRequestRef.current + 1
    geocodeRequestRef.current = currentRequest

    setGeoLoading(true)
    setGeocodeStatus('geocoding')
    setLocalError('')
    if (mode === 'auto') setLastAutoGeocodeQuery(autoGeocodeKey)

    try {
      const result = await api.geocodeAddress({
        street: nextStreet,
        number: nextNumber,
        locality: nextLocality,
        province: nextProvince,
      })
      if (geocodeRequestRef.current !== currentRequest) return

      const normalizedLocality = result.city.trim() || nextLocality
      setResolvedAddress(result.address)
      setLocality(normalizedLocality)
      setCity((current) => {
        const trimmed = current.trim()
        if (!trimmed || trimmed === locality.trim() || trimmed === normalizedLocality) return normalizedLocality
        return current
      })
      setProvince(result.province || nextProvince)
      setLocalities((current) => {
        if (!normalizedLocality || current.includes(normalizedLocality)) return current
        return [normalizedLocality, ...current]
      })
      setLatitude(String(result.latitude))
      setLongitude(String(result.longitude))
      setMapPosition({
        latitude: Number(result.latitude),
        longitude: Number(result.longitude),
      })
      if (mode === 'auto') setLastAutoGeocodeQuery(autoGeocodeKey)
      setGeocodeStatus('ready')
    } catch (caught) {
      if (geocodeRequestRef.current !== currentRequest) return
      setLatitude(null)
      setLongitude(null)
      setResolvedAddress('')
      setMapPosition(null)
      setGeocodeStatus('stale')
      setLocalError(caught instanceof Error ? caught.message : 'No pudimos ubicar esa direccion.')
    } finally {
      if (geocodeRequestRef.current === currentRequest) setGeoLoading(false)
    }
  }

  async function reverseFromMap(point: { latitude: number; longitude: number }) {
    const currentRequest = reverseRequestRef.current + 1
    reverseRequestRef.current = currentRequest

    setReverseLoading(true)
    setLocalError('')
    setGeocodeStatus('reverse')
    setMapPosition(point)

    try {
      const result = await api.reverseGeocodeAddress({
        latitude: String(point.latitude),
        longitude: String(point.longitude),
      })
      if (reverseRequestRef.current !== currentRequest) return

      const nextStreet = result.street.trim() || street.trim()
      const nextNumber = result.number.trim() || number.trim()
      const nextLocality = (locality || city).trim()
      const nextProvince = province.trim()

      setStreet(nextStreet)
      setNumber(nextNumber)
      setLatitude(String(result.latitude))
      setLongitude(String(result.longitude))
      setResolvedAddress(result.address)
      setMapPosition({
        latitude: Number(result.latitude),
        longitude: Number(result.longitude),
      })
      setLastAutoGeocodeQuery(buildAutoGeocodeKey(nextStreet, nextNumber, nextLocality, nextProvince))
      setGeocodeStatus('ready')
    } catch (caught) {
      if (reverseRequestRef.current !== currentRequest) return
      setLatitude(null)
      setLongitude(null)
      setResolvedAddress('')
      setGeocodeStatus('stale')
      setLocalError(caught instanceof Error ? caught.message : 'No pudimos leer la direccion desde el mapa.')
    } finally {
      if (reverseRequestRef.current === currentRequest) setReverseLoading(false)
    }
  }

  async function submit() {
    if (!latitude || !longitude || geocodeStatus !== 'ready') {
      setLocalError('Primero ubica la direccion.')
      return
    }

    setLocalError('')
    await onSave({
      postal_code: postalCode.trim(),
      address: buildAddressLabel(street.trim(), number.trim(), city.trim() || locality.trim(), province.trim()),
      city: city.trim() || locality.trim(),
      province: province.trim(),
      latitude,
      longitude,
      notes: notes.trim(),
    })
  }

  const summaryAddress = resolvedAddress || buildAddressLabel(street.trim(), number.trim(), city.trim() || locality.trim(), province.trim())

  return (
    <section className="grid gap-5">
      <div className="grid gap-2">
        <p className="text-sm font-800 uppercase tracking-[0.14em] text-brand-700">Direccion</p>
        <h2 className="text-2xl font-800 text-slate-950">{title}</h2>
        <p className="max-w-3xl text-sm leading-6 text-slate-600">{description}</p>
      </div>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_20rem] xl:items-start 2xl:grid-cols-[minmax(0,1fr)_21rem]">
        <div className="grid min-w-0 gap-4">
          <SectionCard title="Ubicacion">
            <div className="grid gap-4 md:grid-cols-2 md:items-start">
              <label className="grid min-w-0 gap-1 text-sm font-700 text-slate-700 md:col-span-2">
                Codigo postal
                <div className="flex flex-col gap-2 sm:flex-row">
                  <input
                    className="min-h-11 w-full flex-1 rounded-xl border border-slate-300 bg-white px-4 text-slate-950 transition focus:border-brand-500"
                    inputMode="numeric"
                    placeholder="3100"
                    value={postalCode}
                    onChange={(event) => {
                      setPostalCode(event.target.value)
                      setLastLookupPostalCode('')
                      setLocalities([])
                      setLocality('')
                      setCity('')
                      setProvince('')
                      markAddressDirty()
                    }}
                    onBlur={() => void lookupPostalCode()}
                  />
                  <button
                    className="min-h-11 rounded-xl border border-brand-200 bg-brand-50 px-4 text-sm font-800 text-brand-700 transition hover:border-brand-300 hover:bg-brand-100 disabled:opacity-60"
                    type="button"
                    disabled={lookupLoading}
                    onClick={() => void lookupPostalCode(true)}
                  >
                    {lookupLoading ? 'Buscando...' : 'Buscar'}
                  </button>
                </div>
              </label>

              <label className="grid min-w-0 gap-1 text-sm font-700 text-slate-700">
                Localidad
                <div className="relative">
                  <select
                    className="min-h-11 w-full appearance-none rounded-xl border border-slate-300 bg-white px-4 pr-11 text-slate-950 transition focus:border-brand-500 disabled:bg-slate-50 disabled:text-slate-400"
                    disabled={localities.length === 0}
                    value={locality}
                    onChange={(event) => {
                      const nextLocality = event.target.value
                      setLocality(nextLocality)
                      setCity(nextLocality)
                      markAddressDirty()
                    }}
                  >
                    {localities.length === 0 ? <option value="">Selecciona el CP</option> : null}
                    {localities.map((item) => (
                      <option key={item} value={item}>
                        {item}
                      </option>
                    ))}
                  </select>
                  <span className="pointer-events-none absolute inset-y-0 right-4 flex items-center text-slate-400" aria-hidden="true">
                    <ChevronDown />
                  </span>
                </div>
              </label>

              <label className="grid min-w-0 gap-1 text-sm font-700 text-slate-700">
                Ciudad
                <input
                  className="min-h-11 w-full rounded-xl border border-slate-300 bg-white px-4 text-slate-950 transition focus:border-brand-500"
                  placeholder="Ciudad"
                  value={city}
                  onChange={(event) => setCity(event.target.value)}
                />
              </label>

              <label className="grid min-w-0 gap-1 text-sm font-700 text-slate-700 md:col-span-2">
                Provincia
                <input className="min-h-11 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 text-slate-600" value={province} readOnly />
              </label>
            </div>
          </SectionCard>

          <SectionCard title="Direccion exacta">
            <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_9.5rem] md:items-start">
              <label className="grid min-w-0 gap-1 text-sm font-700 text-slate-700">
                Calle
                <input
                  className="min-h-11 w-full rounded-xl border border-slate-300 bg-white px-4 text-slate-950 transition focus:border-brand-500"
                  placeholder="1 de Mayo"
                  value={street}
                  onChange={(event) => {
                    setStreet(event.target.value)
                    markAddressDirty()
                  }}
                  onBlur={() => void geolocateAddress('auto')}
                />
              </label>

              <label className="grid min-w-0 gap-1 text-sm font-700 text-slate-700">
                Altura
                <input
                  className="min-h-11 w-full rounded-xl border border-slate-300 bg-white px-4 text-slate-950 transition focus:border-brand-500"
                  inputMode="numeric"
                  placeholder="2168"
                  value={number}
                  onChange={(event) => {
                    setNumber(event.target.value)
                    markAddressDirty()
                  }}
                  onBlur={() => void geolocateAddress('auto')}
                />
              </label>
            </div>

            <p className="text-sm leading-6 text-slate-600">Se ubica sola cuando completas calle y altura.</p>

            <label className="grid min-w-0 gap-1 text-sm font-700 text-slate-700">
              {notesLabel}
              <textarea
                className="min-h-28 w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-slate-950 transition focus:border-brand-500"
                placeholder="Ej.: recibir por entrada lateral de 8 a 14."
                value={notes}
                onChange={(event) => setNotes(event.target.value)}
              />
            </label>
          </SectionCard>

          <div className="flex flex-col gap-3 rounded-[1.5rem] border border-slate-200 bg-white p-4 shadow-soft sm:flex-row sm:items-center sm:justify-between">
            <div className="grid gap-1">
              <p className="text-sm font-800 text-slate-950">{statusTitle(geocodeStatus)}</p>
              <p className="text-sm leading-6 text-slate-600">
                {summaryAddress || 'Completa la direccion para ubicarla.'}
              </p>
            </div>
            <button
              className="min-h-11 rounded-full bg-brand-600 px-5 text-sm font-800 text-white transition hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-60"
              type="button"
              disabled={saving || geoLoading || reverseLoading || geocodeStatus !== 'ready'}
              onClick={() => void submit()}
            >
              {saving ? 'Guardando...' : saveLabel}
            </button>
          </div>
        </div>

        <aside className="grid gap-3 self-start rounded-[1.75rem] border border-slate-200 bg-slate-950 p-4 text-white shadow-soft xl:sticky xl:top-24">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-sm font-800 text-white">Mapa</p>
              <p className="text-sm text-slate-300">{statusShort(geocodeStatus)}</p>
            </div>
            <StatusBadge status={geocodeStatus} />
          </div>

          <div className="relative isolate overflow-hidden rounded-[1.35rem] border border-white/10 bg-slate-900 p-2">
            <AddressMap position={mapPosition} disabled={geoLoading || reverseLoading} onMove={(point) => void reverseFromMap(point)} />
          </div>

          <div className="rounded-[1.15rem] border border-white/10 bg-white/5 px-4 py-3 text-sm leading-6 text-slate-200">
            {summaryAddress || 'Completa la direccion para verla en el mapa.'}
          </div>

          <button
            className="min-h-11 rounded-full bg-white px-5 text-sm font-800 text-slate-950 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-60"
            type="button"
            disabled={geoLoading || reverseLoading}
            onClick={() => void geolocateAddress('manual')}
          >
            {reverseLoading ? 'Actualizando...' : geoLoading ? 'Ubicando...' : 'Revalidar direccion'}
          </button>
        </aside>
      </div>
    </section>
  )
}

function SectionCard({ title, children }: { title: string; children: ReactNode }) {
  return (
    <article className="grid gap-4 rounded-[1.5rem] border border-slate-200 bg-white p-5 shadow-soft">
      <h3 className="text-lg font-800 text-slate-950">{title}</h3>
      {children}
    </article>
  )
}

function StatusBadge({ status }: { status: GeocodeStatus }) {
  const styles =
    status === 'ready'
      ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
      : status === 'geocoding' || status === 'reverse'
        ? 'border-amber-200 bg-amber-50 text-amber-700'
        : 'border-white/10 bg-white/5 text-slate-300'

  return <span className={`rounded-full border px-3 py-1 text-xs font-800 ${styles}`}>{statusPillLabel(status)}</span>
}

function ChevronDown() {
  return (
    <svg className="h-4 w-4" viewBox="0 0 16 16" fill="none">
      <path d="m4 6 4 4 4-4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function splitAddress(value: string) {
  const firstChunk = String(value ?? '')
    .split(',')[0]
    .trim()
  const match = firstChunk.match(/^(.+?)\s+(\d+[A-Za-z0-9/-]*)$/)
  if (!match) return { street: firstChunk, number: '' }
  return { street: match[1], number: match[2] }
}

function buildAutoGeocodeKey(street: string, number: string, locality: string, province: string) {
  const values = [street, number, locality, province].map((value) => value.trim().toLowerCase()).filter(Boolean)
  return values.length === 4 ? values.join('|') : ''
}

function buildAddressLabel(street: string, number: string, city: string, province: string) {
  return [street && number ? `${street} ${number}` : street || number, city, province].filter(Boolean).join(', ')
}

function toMapPoint(latitude: string | null, longitude: string | null) {
  if (!latitude || !longitude) return null
  const parsedLatitude = Number(latitude)
  const parsedLongitude = Number(longitude)
  if (Number.isNaN(parsedLatitude) || Number.isNaN(parsedLongitude)) return null
  return {
    latitude: parsedLatitude,
    longitude: parsedLongitude,
  }
}

function statusTitle(status: GeocodeStatus) {
  switch (status) {
    case 'ready':
      return 'Direccion lista'
    case 'geocoding':
      return 'Buscando la direccion'
    case 'reverse':
      return 'Actualizando desde el mapa'
    case 'stale':
      return 'Falta volver a ubicar'
    default:
      return 'Completa la direccion'
  }
}

function statusShort(status: GeocodeStatus) {
  switch (status) {
    case 'ready':
      return 'Direccion validada'
    case 'geocoding':
      return 'Ubicando...'
    case 'reverse':
      return 'Leyendo el pin...'
    case 'stale':
      return 'Requiere validacion'
    default:
      return 'Sin ubicacion'
  }
}

function statusPillLabel(status: GeocodeStatus) {
  switch (status) {
    case 'ready':
      return 'Lista'
    case 'geocoding':
      return 'Buscando'
    case 'reverse':
      return 'Moviendo'
    case 'stale':
      return 'Pendiente'
    default:
      return 'Sin ubicar'
  }
}
