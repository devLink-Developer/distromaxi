import { useEffect, useMemo, useRef, useState } from 'react'
import type { LayerGroup, Map as LeafletMap, Marker as LeafletMarker } from 'leaflet'

export type ServiceAreaPoint = {
  latitude: number
  longitude: number
}

const ARGENTINA_CENTER: ServiceAreaPoint = {
  latitude: -38.4161,
  longitude: -63.6167,
}

export function ServiceAreaMap({
  points,
  disabled = false,
  fullscreen = false,
  onAddPoint,
  onMovePoint,
}: {
  points: ServiceAreaPoint[]
  disabled?: boolean
  fullscreen?: boolean
  onAddPoint: (point: ServiceAreaPoint) => void
  onMovePoint: (index: number, point: ServiceAreaPoint) => void
}) {
  const [mapReady, setMapReady] = useState(false)
  const containerRef = useRef<HTMLDivElement | null>(null)
  const mapRef = useRef<LeafletMap | null>(null)
  const layerRef = useRef<LayerGroup | null>(null)
  const markersRef = useRef<LeafletMarker[]>([])
  const disabledRef = useRef(disabled)
  const onAddPointRef = useRef(onAddPoint)
  const onMovePointRef = useRef(onMovePoint)
  const lastFocusedGeometryRef = useRef<string | null>(null)
  const geometrySignature = useMemo(
    () => points.map((point) => `${point.latitude.toFixed(7)},${point.longitude.toFixed(7)}`).join('|'),
    [points],
  )

  disabledRef.current = disabled
  onAddPointRef.current = onAddPoint
  onMovePointRef.current = onMovePoint

  useEffect(() => {
    let disposed = false

    async function mountMap() {
      if (!containerRef.current || mapRef.current) return

      const L = await import('leaflet')
      if (disposed || !containerRef.current) return

      const map = L.map(containerRef.current, {
        zoomControl: false,
        attributionControl: true,
      }).setView([ARGENTINA_CENTER.latitude, ARGENTINA_CENTER.longitude], 4)

      L.control.zoom({ position: 'bottomright' }).addTo(map)
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
        attribution: '&copy; OpenStreetMap contributors',
      }).addTo(map)

      map.on('click', (event: L.LeafletMouseEvent) => {
        if (disabledRef.current) return
        onAddPointRef.current({
          latitude: event.latlng.lat,
          longitude: event.latlng.lng,
        })
      })

      mapRef.current = map
      layerRef.current = L.layerGroup().addTo(map)
      setMapReady(true)
      requestAnimationFrame(() => map.invalidateSize())
    }

    void mountMap()

    return () => {
      disposed = true
      markersRef.current = []
      layerRef.current?.remove()
      mapRef.current?.remove()
      layerRef.current = null
      mapRef.current = null
    }
  }, [])

  useEffect(() => {
    const map = mapRef.current
    if (!map) return
    requestAnimationFrame(() => map.invalidateSize())
  }, [fullscreen])

  useEffect(() => {
    let disposed = false

    async function drawArea() {
      const map = mapRef.current
      const layer = layerRef.current
      if (!map || !layer) return

      const L = await import('leaflet')
      if (disposed) return

      layer.clearLayers()
      markersRef.current = []

      const latLngs = points.map((point) => [point.latitude, point.longitude] as [number, number])
      if (latLngs.length >= 3) {
        L.polygon(latLngs, {
          color: '#0369a1',
          fillColor: '#0ea5e9',
          fillOpacity: 0.18,
          opacity: 0.95,
          weight: 3,
        }).addTo(layer)
      } else if (latLngs.length >= 2) {
        L.polyline(latLngs, {
          color: '#0369a1',
          dashArray: '6 8',
          opacity: 0.9,
          weight: 3,
        }).addTo(layer)
      }

      points.forEach((point, index) => {
        const marker = L.marker([point.latitude, point.longitude], {
          draggable: !disabled,
          icon: createVertexIcon(L, index),
        }).addTo(layer)

        marker.on('dragend', () => {
          if (disabledRef.current) return
          const latLng = marker.getLatLng()
          onMovePointRef.current(index, {
            latitude: latLng.lat,
            longitude: latLng.lng,
          })
        })

        markersRef.current.push(marker)
      })

      if (geometrySignature === lastFocusedGeometryRef.current) return

      if (points.length === 0) {
        map.setView([ARGENTINA_CENTER.latitude, ARGENTINA_CENTER.longitude], 4)
      } else if (points.length === 1) {
        map.setView([points[0].latitude, points[0].longitude], 8)
      } else if (points.length > 1) {
        map.fitBounds(latLngs, { padding: [30, 30], maxZoom: 13 })
      }
      lastFocusedGeometryRef.current = geometrySignature
    }

    void drawArea()

    return () => {
      disposed = true
    }
  }, [disabled, geometrySignature, mapReady, points])

  return (
    <div
      ref={containerRef}
      aria-label="Mapa de alcance"
      className={`service-area-map-canvas relative isolate w-full ${fullscreen ? 'h-full min-h-[70dvh]' : 'h-[28rem] min-h-[22rem]'}`}
    />
  )
}

function createVertexIcon(L: typeof import('leaflet'), index: number) {
  return L.divIcon({
    className: 'service-area-vertex-marker',
    iconSize: [34, 34],
    iconAnchor: [17, 17],
    html: `<span>${index + 1}</span>`,
  })
}
