'use client'
import { useQuery } from '@tanstack/react-query'
import dynamic from 'next/dynamic'
import { useAuthStore } from '@/stores/auth-store'
import { api } from '@ebalangay/shared'

const LiveMap = dynamic(() => import('@/components/map/live-map'), { ssr: false })

export default function MapPage() {
  const { accessToken } = useAuthStore()

  const { data: deliveries } = useQuery({
    queryKey: ['live-deliveries'],
    queryFn: () => api.analytics.getLiveDeliveries(accessToken!),
    enabled: !!accessToken,
    refetchInterval: 10_000,
  })

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold text-gray-900">Live delivery map</h1>
        <span className="text-sm text-gray-500">{(deliveries ?? []).length} active deliveries</span>
      </div>
      <LiveMap deliveries={deliveries ?? []} />
    </div>
  )
}
