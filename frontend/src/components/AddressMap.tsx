import { useEffect, useRef } from 'react'
import type { Map as LeafletMap, Marker as LeafletMarker } from 'leaflet'

export type MapPoint = {
  latitude: number
  longitude: number
}

const DEFAULT_POSITION: MapPoint = {
  latitude: -34.6037,
  longitude: -64.2,
}

export function AddressMap({
  position,
  fallbackPosition = DEFAULT_POSITION,
  disabled = false,
  onMove,
}: {
  position: MapPoint | null
  fallbackPosition?: MapPoint
  disabled?: boolean
  onMove: (point: MapPoint) => void
}) {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const mapRef = useRef<LeafletMap | null>(null)
  const markerRef = useRef<LeafletMarker | null>(null)
  const disabledRef = useRef(disabled)
  const onMoveRef = useRef(onMove)
  const activePosition = position ?? fallbackPosition

  disabledRef.current = disabled
  onMoveRef.current = onMove

  useEffect(() => {
    let disposed = false

    async function mountMap() {
      if (!containerRef.current || mapRef.current) return

      const L = await import('leaflet')
      if (disposed || !containerRef.current) return

      const map = L.map(containerRef.current, {
        zoomControl: false,
        attributionControl: true,
      }).setView([activePosition.latitude, activePosition.longitude], position ? 16 : 5)

      L.control.zoom({ position: 'bottomright' }).addTo(map)
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
        attribution: '&copy; OpenStreetMap contributors',
      }).addTo(map)

      const marker = L.marker([activePosition.latitude, activePosition.longitude], {
        draggable: !disabledRef.current,
        icon: createMarkerIcon(L),
      }).addTo(map)

      marker.on('dragend', () => {
        if (disabledRef.current) return
        const latLng = marker.getLatLng()
        onMoveRef.current({
          latitude: latLng.lat,
          longitude: latLng.lng,
        })
      })

      map.on('click', (event: L.LeafletMouseEvent) => {
        if (disabledRef.current) return
        marker.setLatLng(event.latlng)
        onMoveRef.current({
          latitude: event.latlng.lat,
          longitude: event.latlng.lng,
        })
      })

      mapRef.current = map
      markerRef.current = marker
      requestAnimationFrame(() => map.invalidateSize())
    }

    void mountMap()

    return () => {
      disposed = true
      markerRef.current?.remove()
      mapRef.current?.remove()
      markerRef.current = null
      mapRef.current = null
    }
  }, [])

  useEffect(() => {
    const map = mapRef.current
    const marker = markerRef.current
    if (!map || !marker) return

    marker.setLatLng([activePosition.latitude, activePosition.longitude])
    map.setView([activePosition.latitude, activePosition.longitude], position ? 16 : 5, {
      animate: true,
      duration: 0.35,
    })
  }, [activePosition.latitude, activePosition.longitude, position])

  useEffect(() => {
    const map = mapRef.current
    const marker = markerRef.current
    if (!map || !marker) return

    if (disabled) {
      map.dragging.disable()
      marker.dragging?.disable()
      return
    }

    map.dragging.enable()
    marker.dragging?.enable()
  }, [disabled])

  return <div ref={containerRef} aria-label="Mapa de geolocalizacion" className="address-map-canvas relative isolate h-[320px] w-full sm:h-[360px]" />
}

function createMarkerIcon(L: typeof import('leaflet')) {
  return L.divIcon({
    className: 'address-map-marker',
    iconSize: [30, 30],
    iconAnchor: [15, 15],
    html: `
      <span class="address-map-marker-shell">
        <span class="address-map-marker-pulse"></span>
        <span class="address-map-marker-core"></span>
      </span>
    `,
  })
}
