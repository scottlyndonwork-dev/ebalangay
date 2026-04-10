'use client'
import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import dynamic from 'next/dynamic'
import { io, type Socket } from 'socket.io-client'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { Navbar } from '@/components/layout/navbar'
import { useAuthStore } from '@/stores/auth-store'

// Leaflet must be loaded client-side only
const TrackingMap = dynamic(() => import('@/components/map/tracking-map'), { ssr: false })

interface RiderLocation {
  lat: number
  lng: number
  orderId: string
}

export default function TrackPage() {
  const { id } = useParams<{ id: string }>()
  const { accessToken } = useAuthStore()
  const [riderLocation, setRiderLocation] = useState<{ lat: number; lng: number } | null>(null)
  const [status, setStatus] = useState('Connecting…')

  useEffect(() => {
    const BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001'
    const socket: Socket = io(BASE, {
      auth: { token: accessToken },
      transports: ['websocket'],
    })

    socket.on('connect', () => setStatus('Connected — waiting for rider location'))

    socket.emit('subscribe:order', { orderId: id })

    socket.on('rider:location', (data: RiderLocation) => {
      if (data.orderId === id) {
        setRiderLocation({ lat: data.lat, lng: data.lng })
        setStatus('Rider is on the way')
      }
    })

    socket.on('order:update', (data: { type: string }) => {
      if (data.type === 'DELIVERED') setStatus('Delivered!')
    })

    return () => { socket.disconnect() }
  }, [id, accessToken])

  return (
    <>
      <Navbar />
      <main className="max-w-xl mx-auto px-4 py-4 space-y-3">
        <div className="flex items-center gap-3">
          <Link href={`/orders/${id}`} className="text-gray-400 hover:text-gray-600">
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <div>
            <h1 className="font-semibold text-gray-900">Live tracking</h1>
            <p className="text-xs text-gray-500">{status}</p>
          </div>
        </div>
        <TrackingMap riderLocation={riderLocation} />
      </main>
    </>
  )
}
