import { useEffect, useRef } from 'react'
import L from 'leaflet'

delete (L.Icon.Default.prototype as any)._getIconUrl
L.Icon.Default.mergeOptions({
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
})

export interface MapMarker {
  lat: number
  lng: number
  label: string
}

interface Props {
  center: [number, number]
  zoom?: number
  markers?: MapMarker[]
  className?: string
}

export default function Map({ center, zoom = 14, markers = [], className = 'h-64' }: Props) {
  const ref = useRef<HTMLDivElement>(null)
  const map = useRef<L.Map | null>(null)
  const markerLayer = useRef<L.LayerGroup | null>(null)

  useEffect(() => {
    if (!ref.current || map.current) return
    map.current = L.map(ref.current).setView(center, zoom)
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© <a href="https://osm.org/copyright">OpenStreetMap</a>',
      maxZoom: 19,
    }).addTo(map.current)
    markerLayer.current = L.layerGroup().addTo(map.current)
    return () => {
      map.current?.remove()
      map.current = null
    }
  }, [])

  useEffect(() => {
    map.current?.setView(center, zoom)
  }, [center[0], center[1], zoom])

  useEffect(() => {
    if (!markerLayer.current) return
    markerLayer.current.clearLayers()
    markers.forEach(m => {
      L.marker([m.lat, m.lng]).bindPopup(m.label).addTo(markerLayer.current!)
    })
    if (markers.length > 0 && map.current) {
      map.current.setView([markers[0].lat, markers[0].lng], zoom)
    }
  }, [JSON.stringify(markers)])

  return <div ref={ref} className={`${className} rounded-xl z-0`} style={{ minHeight: 200 }} />
}
