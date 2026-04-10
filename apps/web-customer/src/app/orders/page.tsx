'use client'
import { useQuery } from '@tanstack/react-query'
import Link from 'next/link'
import { ChevronRight } from 'lucide-react'
import { Navbar } from '@/components/layout/navbar'
import { useAuthStore } from '@/stores/auth-store'
import { api, type Order } from '@ebalangay/shared'
import { formatDate, formatPeso, ORDER_STATUS_LABELS } from '@/lib/utils'

const STATUS_COLORS: Record<string, string> = {
  PLACED: 'bg-yellow-100 text-yellow-800',
  CONFIRMED: 'bg-blue-100 text-blue-800',
  PREPARING: 'bg-orange-100 text-orange-800',
  READY_FOR_PICKUP: 'bg-purple-100 text-purple-800',
  PICKED_UP: 'bg-indigo-100 text-indigo-800',
  IN_TRANSIT: 'bg-cyan-100 text-cyan-800',
  DELIVERED: 'bg-green-100 text-green-800',
  CANCELLED: 'bg-red-100 text-red-800',
  FAILED: 'bg-gray-100 text-gray-800',
}

export default function OrdersPage() {
  const { accessToken } = useAuthStore()

  const { data, isLoading } = useQuery({
    queryKey: ['my-orders'],
    queryFn: () => api.orders.list({}, accessToken!),
    enabled: !!accessToken,
  })

  return (
    <>
      <Navbar />
      <main className="max-w-xl mx-auto px-4 py-6 space-y-4">
        <h1 className="text-xl font-semibold text-gray-900">My orders</h1>

        {isLoading && (
          <div className="space-y-3">{[...Array(4)].map((_, i) => <div key={i} className="h-20 rounded-2xl bg-gray-200 animate-pulse" />)}</div>
        )}

        {!isLoading && (data?.orders ?? []).length === 0 && (
          <div className="text-center py-16 text-gray-400">
            <p className="text-4xl mb-3">📦</p>
            <p>No orders yet</p>
          </div>
        )}

        <div className="space-y-3">
          {(data?.orders ?? []).map((order: Order) => (
            <Link key={order.id} href={`/orders/${order.id}`}>
              <div className="bg-white rounded-2xl border border-gray-200 p-4 flex items-center justify-between hover:shadow-sm transition-shadow">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-mono text-xs text-gray-500">#{order.id.slice(-8).toUpperCase()}</span>
                    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium ${STATUS_COLORS[order.status] ?? 'bg-gray-100 text-gray-700'}`}>
                      {ORDER_STATUS_LABELS[order.status] ?? order.status}
                    </span>
                  </div>
                  <p className="text-sm font-medium text-gray-900">{order.merchant?.name ?? 'Store'}</p>
                  <p className="text-xs text-gray-500">{formatPeso(order.totalAmount)} · {formatDate(order.placedAt)}</p>
                </div>
                <ChevronRight className="h-5 w-5 text-gray-400 shrink-0" />
              </div>
            </Link>
          ))}
        </div>
      </main>
    </>
  )
}
