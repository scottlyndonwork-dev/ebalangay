'use client'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useParams, useRouter } from 'next/navigation'
import { ArrowLeft } from 'lucide-react'
import { useAuthStore } from '@/stores/auth-store'
import { api } from '@ebalangay/shared'
import { formatDate, formatPeso, ORDER_STATUS_COLORS, ORDER_STATUS_LABELS } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

export default function OrderDetailPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const { accessToken } = useAuthStore()
  const qc = useQueryClient()

  const { data: order, isLoading } = useQuery({
    queryKey: ['order', id],
    queryFn: () => api.orders.get(id, accessToken!),
    enabled: !!accessToken,
  })

  const cancel = useMutation({
    mutationFn: () => api.orders.cancel(id, accessToken!),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['order', id] })
      qc.invalidateQueries({ queryKey: ['orders'] })
    },
  })

  if (isLoading) return <div className="p-6 animate-pulse space-y-4">{[...Array(4)].map((_, i) => <div key={i} className="h-20 rounded-xl bg-gray-200" />)}</div>
  if (!order) return <div className="p-6 text-gray-500">Order not found</div>

  const colorClass = ORDER_STATUS_COLORS[order.status] ?? 'bg-gray-100 text-gray-800'

  return (
    <div className="p-6 space-y-5 max-w-2xl">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" onClick={() => router.back()}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <h1 className="text-xl font-semibold">Order #{order.id.slice(-8).toUpperCase()}</h1>
          <p className="text-sm text-gray-500">{formatDate(order.placedAt)}</p>
        </div>
        <span className={`ml-auto inline-flex items-center rounded-full px-3 py-1 text-xs font-medium ${colorClass}`}>
          {ORDER_STATUS_LABELS[order.status] ?? order.status}
        </span>
      </div>

      <Card>
        <CardHeader><CardTitle>Customer</CardTitle></CardHeader>
        <CardContent className="space-y-1 text-sm text-gray-700">
          <p className="font-medium">{order.customer?.name ?? '—'}</p>
          <p>{order.addressLine}, {order.barangay}</p>
          {order.notes && <p className="text-gray-500">Note: {order.notes}</p>}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Items</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          {order.items?.map(item => (
            <div key={item.id} className="flex justify-between text-sm">
              <span className="text-gray-700">{item.product?.name ?? item.productId} × {item.quantity}</span>
              <span className="font-medium">{formatPeso(item.unitPrice * item.quantity)}</span>
            </div>
          ))}
          <div className="border-t pt-3 space-y-1">
            <div className="flex justify-between text-sm text-gray-500">
              <span>Subtotal</span><span>{formatPeso(order.subtotal)}</span>
            </div>
            <div className="flex justify-between text-sm text-gray-500">
              <span>Delivery fee</span><span>{formatPeso(order.deliveryFee)}</span>
            </div>
            <div className="flex justify-between text-sm font-semibold text-gray-900">
              <span>Total</span><span>{formatPeso(order.totalAmount)}</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {order.delivery && (
        <Card>
          <CardHeader><CardTitle>Delivery</CardTitle></CardHeader>
          <CardContent className="text-sm text-gray-700 space-y-1">
            <p>Status: <span className="font-medium capitalize">{order.delivery.status}</span></p>
            {order.delivery.deliveredAt && <p>Delivered: {formatDate(order.delivery.deliveredAt)}</p>}
          </CardContent>
        </Card>
      )}

      {['PLACED', 'CONFIRMED'].includes(order.status) && (
        <Button
          variant="danger"
          onClick={() => cancel.mutate()}
          loading={cancel.isPending}
        >
          Cancel order
        </Button>
      )}
    </div>
  )
}
