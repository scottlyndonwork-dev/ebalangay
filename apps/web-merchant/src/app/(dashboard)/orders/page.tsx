'use client'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import Link from 'next/link'
import { ChevronRight, RefreshCw } from 'lucide-react'
import { useAuthStore } from '@/stores/auth-store'
import { api, type Order } from '@ebalangay/shared'
import { formatDate, formatPeso, ORDER_STATUS_COLORS, ORDER_STATUS_LABELS } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'

const NEXT_STATUS: Record<string, string> = {
  PLACED: 'CONFIRMED',
  CONFIRMED: 'PREPARING',
  PREPARING: 'READY_FOR_PICKUP',
}

export default function OrdersPage() {
  const { accessToken } = useAuthStore()
  const qc = useQueryClient()
  const [filter, setFilter] = useState('active')

  const { data, isLoading } = useQuery({
    queryKey: ['orders', filter],
    queryFn: () => api.orders.list(
      filter === 'active' ? undefined : { status: filter },
      accessToken!
    ),
    enabled: !!accessToken,
    refetchInterval: 15_000,
  })

  const advance = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) =>
      api.orders.updateStatus(id, status, accessToken!),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['orders'] }),
  })

  const orders = data?.orders ?? []
  const activeOrders = filter === 'active'
    ? orders.filter(o => ['PLACED', 'CONFIRMED', 'PREPARING', 'READY_FOR_PICKUP'].includes(o.status))
    : orders

  const tabs = ['active', 'DELIVERED', 'CANCELLED']

  return (
    <div className="p-6 space-y-5">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold text-gray-900">Orders</h1>
        <Button variant="ghost" size="sm" onClick={() => qc.invalidateQueries({ queryKey: ['orders'] })}>
          <RefreshCw className="h-4 w-4" />
        </Button>
      </div>

      <div className="flex gap-2">
        {tabs.map(t => (
          <button
            key={t}
            onClick={() => setFilter(t)}
            className={`px-4 py-1.5 rounded-full text-sm font-medium transition-colors ${
              filter === t ? 'bg-brand-600 text-white' : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50'
            }`}
          >
            {t === 'active' ? 'Active' : ORDER_STATUS_LABELS[t] ?? t}
          </button>
        ))}
      </div>

      {isLoading && (
        <div className="space-y-3">
          {[...Array(5)].map((_, i) => <div key={i} className="h-20 rounded-xl bg-gray-200 animate-pulse" />)}
        </div>
      )}

      <div className="space-y-3">
        {!isLoading && activeOrders.length === 0 && (
          <div className="text-center py-16 text-gray-400">No orders found</div>
        )}
        {activeOrders.map((order: Order) => (
          <OrderCard
            key={order.id}
            order={order}
            onAdvance={(id, status) => advance.mutate({ id, status })}
            advancing={advance.isPending}
          />
        ))}
      </div>
    </div>
  )
}

function OrderCard({
  order,
  onAdvance,
  advancing,
}: {
  order: Order
  onAdvance: (id: string, status: string) => void
  advancing: boolean
}) {
  const nextStatus = NEXT_STATUS[order.status]
  const colorClass = ORDER_STATUS_COLORS[order.status] ?? 'bg-gray-100 text-gray-800'

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="font-mono text-xs text-gray-500">#{order.id.slice(-8).toUpperCase()}</span>
            <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${colorClass}`}>
              {ORDER_STATUS_LABELS[order.status] ?? order.status}
            </span>
          </div>
          <p className="text-sm font-medium text-gray-900">{order.customer?.name ?? 'Customer'}</p>
          <p className="text-xs text-gray-500">{order.items?.length ?? 0} items · {formatPeso(order.totalAmount)}</p>
          <p className="text-xs text-gray-400">{formatDate(order.placedAt)}</p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {nextStatus && (
            <Button
              size="sm"
              onClick={() => onAdvance(order.id, nextStatus)}
              disabled={advancing}
            >
              {ORDER_STATUS_LABELS[nextStatus]}
            </Button>
          )}
          <Link href={`/orders/${order.id}`}>
            <Button variant="ghost" size="sm"><ChevronRight className="h-4 w-4" /></Button>
          </Link>
        </div>
      </div>
    </div>
  )
}
