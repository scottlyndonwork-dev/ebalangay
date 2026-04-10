'use client'
import { useQuery } from '@tanstack/react-query'
import { useAuthStore } from '@/stores/auth-store'
import { api, type Order } from '@ebalangay/shared'
import { formatDate, formatPeso, ORDER_STATUS_COLORS, ORDER_STATUS_LABELS } from '@/lib/utils'
import Link from 'next/link'
import { ChevronRight } from 'lucide-react'

export default function B2BPage() {
  const { accessToken } = useAuthStore()

  const { data, isLoading } = useQuery({
    queryKey: ['b2b-orders'],
    queryFn: () => api.orders.list({}, accessToken!),
    enabled: !!accessToken,
  })

  const b2bOrders = (data?.orders ?? []).filter((o: Order) => o.isB2B)

  return (
    <div className="p-6 space-y-5">
      <div>
        <h1 className="text-xl font-semibold text-gray-900">B2B Orders</h1>
        <p className="text-sm text-gray-500">Wholesale and business-to-business orders</p>
      </div>

      {isLoading && (
        <div className="space-y-3">{[...Array(3)].map((_, i) => <div key={i} className="h-20 rounded-xl bg-gray-200 animate-pulse" />)}</div>
      )}

      <div className="space-y-3">
        {!isLoading && b2bOrders.length === 0 && (
          <div className="text-center py-16 text-gray-400">No B2B orders yet</div>
        )}
        {b2bOrders.map((order: Order) => {
          const colorClass = ORDER_STATUS_COLORS[order.status] ?? 'bg-gray-100 text-gray-800'
          return (
            <div key={order.id} className="bg-white rounded-xl border border-gray-200 p-4 flex items-center justify-between">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span className="font-mono text-xs text-gray-500">#{order.id.slice(-8).toUpperCase()}</span>
                  <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${colorClass}`}>
                    {ORDER_STATUS_LABELS[order.status]}
                  </span>
                </div>
                <p className="text-sm font-medium text-gray-900">{order.customer?.name ?? 'Business customer'}</p>
                <p className="text-xs text-gray-500">{formatPeso(order.totalAmount)} · {formatDate(order.placedAt)}</p>
              </div>
              <Link href={`/orders/${order.id}`}>
                <ChevronRight className="h-5 w-5 text-gray-400" />
              </Link>
            </div>
          )
        })}
      </div>
    </div>
  )
}
