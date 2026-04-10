'use client'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, MapPin } from 'lucide-react'
import { Navbar } from '@/components/layout/navbar'
import { Button } from '@/components/ui/button'
import { useAuthStore } from '@/stores/auth-store'
import { api } from '@ebalangay/shared'
import { formatDate, formatPeso, ORDER_STATUS_LABELS } from '@/lib/utils'

const STATUS_STEPS = ['PLACED', 'CONFIRMED', 'PREPARING', 'READY_FOR_PICKUP', 'PICKED_UP', 'IN_TRANSIT', 'DELIVERED']

export default function OrderDetailPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const { accessToken } = useAuthStore()
  const qc = useQueryClient()

  const { data: order, isLoading } = useQuery({
    queryKey: ['order', id],
    queryFn: () => api.orders.get(id, accessToken!),
    enabled: !!accessToken,
    refetchInterval: 20_000,
  })

  const cancel = useMutation({
    mutationFn: () => api.orders.cancel(id, accessToken!),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['order', id] }),
  })

  if (isLoading) return <><Navbar /><div className="max-w-xl mx-auto p-6 animate-pulse space-y-3">{[...Array(4)].map((_, i) => <div key={i} className="h-16 rounded-2xl bg-gray-200" />)}</div></>
  if (!order) return <><Navbar /><div className="max-w-xl mx-auto p-6 text-gray-500">Order not found</div></>

  const stepIndex = STATUS_STEPS.indexOf(order.status)
  const isActive = !['DELIVERED', 'CANCELLED', 'FAILED'].includes(order.status)

  return (
    <>
      <Navbar />
      <main className="max-w-xl mx-auto px-4 py-6 space-y-4">
        <div className="flex items-center gap-3">
          <button onClick={() => router.back()} className="text-gray-400 hover:text-gray-600">
            <ArrowLeft className="h-5 w-5" />
          </button>
          <div>
            <h1 className="font-semibold text-gray-900">Order #{order.id.slice(-8).toUpperCase()}</h1>
            <p className="text-xs text-gray-500">{formatDate(order.placedAt)}</p>
          </div>
        </div>

        {/* Status timeline */}
        {!['CANCELLED', 'FAILED'].includes(order.status) && (
          <div className="bg-white rounded-2xl border border-gray-200 p-4">
            <h2 className="text-sm font-medium text-gray-700 mb-3">Order status</h2>
            <div className="space-y-2">
              {STATUS_STEPS.map((s, i) => {
                const done = i < stepIndex
                const current = i === stepIndex
                return (
                  <div key={s} className="flex items-center gap-3">
                    <div className={`h-3 w-3 rounded-full shrink-0 ${done ? 'bg-brand-600' : current ? 'bg-brand-400 ring-4 ring-brand-100' : 'bg-gray-200'}`} />
                    <span className={`text-sm ${current ? 'text-brand-700 font-semibold' : done ? 'text-gray-500' : 'text-gray-300'}`}>
                      {ORDER_STATUS_LABELS[s] ?? s}
                    </span>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* Live track button */}
        {['PICKED_UP', 'IN_TRANSIT'].includes(order.status) && (
          <Link href={`/orders/${id}/track`}>
            <Button className="w-full" variant="secondary">
              <MapPin className="h-4 w-4" /> Track delivery
            </Button>
          </Link>
        )}

        {/* Order items */}
        <div className="bg-white rounded-2xl border border-gray-200 p-4 space-y-2">
          <h2 className="text-sm font-medium text-gray-700 mb-2">{order.merchant?.name ?? 'Store'}</h2>
          {order.items?.map(item => (
            <div key={item.id} className="flex justify-between text-sm text-gray-700">
              <span>{item.product?.name ?? item.productId} × {item.quantity}</span>
              <span>{formatPeso(item.unitPrice * item.quantity)}</span>
            </div>
          ))}
          <div className="pt-2 border-t space-y-1">
            <div className="flex justify-between text-xs text-gray-500"><span>Delivery fee</span><span>{formatPeso(order.deliveryFee)}</span></div>
            <div className="flex justify-between font-semibold text-gray-900"><span>Total</span><span>{formatPeso(order.totalAmount)}</span></div>
          </div>
        </div>

        {['PLACED', 'CONFIRMED'].includes(order.status) && (
          <Button variant="danger" className="w-full" onClick={() => cancel.mutate()} loading={cancel.isPending}>
            Cancel order
          </Button>
        )}
      </main>
    </>
  )
}
