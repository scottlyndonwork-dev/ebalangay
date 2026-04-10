'use client'
import { useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import { useAuthStore } from '@/stores/auth-store'
import { api, type Order } from '@ebalangay/shared'
import { formatDate, formatPeso } from '@/lib/utils'

const STATUS_COLORS: Record<string, string> = {
  PLACED: 'bg-yellow-100 text-yellow-800',
  CONFIRMED: 'bg-blue-100 text-blue-800',
  PREPARING: 'bg-orange-100 text-orange-800',
  DELIVERED: 'bg-green-100 text-green-800',
  CANCELLED: 'bg-red-100 text-red-800',
  FAILED: 'bg-gray-100 text-gray-700',
}

export default function AdminOrdersPage() {
  const { accessToken } = useAuthStore()
  const [status, setStatus] = useState('')

  const { data, isLoading } = useQuery({
    queryKey: ['admin-orders', status],
    queryFn: () => api.orders.list({ status: status || undefined }, accessToken!),
    enabled: !!accessToken,
    refetchInterval: 20_000,
  })

  const STATUSES = ['', 'PLACED', 'CONFIRMED', 'PREPARING', 'READY_FOR_PICKUP', 'IN_TRANSIT', 'DELIVERED', 'CANCELLED']

  return (
    <div className="p-6 space-y-5">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold text-gray-900">Orders</h1>
        <span className="text-sm text-gray-500">{data?.total ?? 0} total</span>
      </div>

      <div className="flex gap-2 flex-wrap">
        {STATUSES.map(s => (
          <button key={s} onClick={() => setStatus(s)}
            className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${status === s ? 'bg-brand-600 text-white' : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'}`}>
            {s || 'All'}
          </button>
        ))}
      </div>

      {isLoading && <div className="space-y-2">{[...Array(8)].map((_, i) => <div key={i} className="h-12 rounded-lg bg-gray-200 animate-pulse" />)}</div>}

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="text-left py-3 px-4 text-xs font-medium text-gray-500">Order ID</th>
              <th className="text-left py-3 px-4 text-xs font-medium text-gray-500">Customer</th>
              <th className="text-left py-3 px-4 text-xs font-medium text-gray-500">Merchant</th>
              <th className="text-left py-3 px-4 text-xs font-medium text-gray-500">Amount</th>
              <th className="text-left py-3 px-4 text-xs font-medium text-gray-500">Status</th>
              <th className="text-left py-3 px-4 text-xs font-medium text-gray-500">Date</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {(data?.orders ?? []).map((o: Order) => (
              <tr key={o.id} className="hover:bg-gray-50">
                <td className="py-3 px-4 font-mono text-xs text-gray-500">#{o.id.slice(-8).toUpperCase()}</td>
                <td className="py-3 px-4 text-gray-700">{o.customer?.name ?? '—'}</td>
                <td className="py-3 px-4 text-gray-700">{o.merchant?.name ?? '—'}</td>
                <td className="py-3 px-4 font-medium text-gray-900">{formatPeso(o.totalAmount)}</td>
                <td className="py-3 px-4">
                  <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium ${STATUS_COLORS[o.status] ?? 'bg-gray-100 text-gray-700'}`}>
                    {o.status}
                  </span>
                </td>
                <td className="py-3 px-4 text-gray-500 text-xs">{formatDate(o.placedAt)}</td>
              </tr>
            ))}
            {!isLoading && (data?.orders ?? []).length === 0 && (
              <tr><td colSpan={6} className="py-8 text-center text-gray-400">No orders found</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
