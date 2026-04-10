'use client'
import { useEffect } from 'react'
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'

// Fix default leaflet icon paths broken by webpack
delete (L.Icon.Default.prototype as unknown as Record<string, unknown>)._getIconUrl
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
})

const riderIcon = new L.Icon({
  iconUrl: 'https://cdn-icons-png.flaticon.com/512/3097/3097144.png',
  iconSize: [36, 36],
  iconAnchor: [18, 36],
  popupAnchor: [0, -36],
})

// Default center: Butuan City
const DEFAULT_CENTER: [number, number] = [8.9475, 125.5406]

function FlyTo({ position }: { position: [number, number] }) {
  const map = useMap()
  useEffect(() => {
    map.flyTo(position, 15, { duration: 1.2 })
  }, [map, position])
  return null
}

interface Props {
  riderLocation: { lat: number; lng: number } | null
}

export default function TrackingMap({ riderLocation }: Props) {
  const position: [number, number] = riderLocation
    ? [riderLocation.lat, riderLocation.lng]
    : DEFAULT_CENTER

  return (
    <div className="h-[420px] w-full rounded-2xl overflow-hidden border border-gray-200">
      <MapContainer center={position} zoom={13} style={{ height: '100%', width: '100%' }}>
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        {riderLocation && (
          <>
            <FlyTo position={position} />
            <Marker position={position} icon={riderIcon}>
              <Popup>Rider is here</Popup>
            </Marker>
          </>
        )}
        {!riderLocation && (
          <div className="absolute inset-0 flex items-center justify-center bg-white/60 z-[1000] text-sm text-gray-500">
            Waiting for rider location…
          </div>
        )}
      </MapContainer>
    </div>
  )
}
