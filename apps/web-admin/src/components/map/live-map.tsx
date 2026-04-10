'use client'
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import type { LiveDelivery } from '@ebalangay/shared'

delete (L.Icon.Default.prototype as unknown as Record<string, unknown>)._getIconUrl
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
})

const riderIcon = new L.Icon({
  iconUrl: 'https://cdn-icons-png.flaticon.com/512/3097/3097144.png',
  iconSize: [32, 32],
  iconAnchor: [16, 32],
  popupAnchor: [0, -32],
})

const BUTUAN: [number, number] = [8.9475, 125.5406]

export default function LiveMap({ deliveries }: { deliveries: LiveDelivery[] }) {
  return (
    <div className="h-[calc(100vh-160px)] w-full rounded-xl overflow-hidden border border-gray-200">
      <MapContainer center={BUTUAN} zoom={13} style={{ height: '100%', width: '100%' }}>
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        {deliveries.map(d => (
          <Marker key={d.orderId} position={[d.lat, d.lng]} icon={riderIcon}>
            <Popup>
              <div className="text-sm">
                <p className="font-semibold">{d.riderName}</p>
                <p className="text-gray-500">Order #{d.orderId.slice(-6)}</p>
                <p className="text-gray-500 capitalize">{d.status}</p>
              </div>
            </Popup>
          </Marker>
        ))}
      </MapContainer>
    </div>
  )
}
