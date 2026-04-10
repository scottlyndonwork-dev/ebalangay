'use client'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useMutation } from '@tanstack/react-query'
import { useRouter } from 'next/navigation'
import { Navbar } from '@/components/layout/navbar'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useCartStore } from '@/stores/cart-store'
import { useAuthStore } from '@/stores/auth-store'
import { api } from '@ebalangay/shared'
import { formatPeso } from '@/lib/utils'

const schema = z.object({
  addressLine: z.string().min(5, 'Please enter your full address'),
  barangay: z.string().min(2, 'Barangay is required'),
  notes: z.string().max(300).optional(),
})
type FormData = z.infer<typeof schema>

export default function CheckoutPage() {
  const router = useRouter()
  const { items, merchantId, total, clearCart } = useCartStore()
  const { accessToken } = useAuthStore()

  const { register, handleSubmit, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
  })

  const placeOrder = useMutation({
    mutationFn: (data: FormData) =>
      api.orders.create({
        merchantId: merchantId!,
        addressLine: data.addressLine,
        barangay: data.barangay,
        notes: data.notes,
        items: items.map(i => ({ productId: i.product.id, quantity: i.quantity })),
      }, accessToken!),
    onSuccess: (order) => {
      clearCart()
      router.push(`/checkout/success?orderId=${order.id}`)
    },
  })

  if (items.length === 0) {
    router.push('/cart')
    return null
  }

  return (
    <>
      <Navbar />
      <main className="max-w-xl mx-auto px-4 py-6 space-y-5">
        <h1 className="text-xl font-semibold text-gray-900">Checkout</h1>

        <div className="bg-white rounded-2xl border border-gray-200 p-4 space-y-2">
          <h2 className="font-medium text-gray-900 text-sm mb-3">Order summary</h2>
          {items.map(({ product, quantity }) => (
            <div key={product.id} className="flex justify-between text-sm text-gray-700">
              <span>{product.name} × {quantity}</span>
              <span>{formatPeso(product.price * quantity)}</span>
            </div>
          ))}
          <div className="flex justify-between font-semibold text-gray-900 pt-2 border-t">
            <span>Subtotal</span><span>{formatPeso(total())}</span>
          </div>
        </div>

        <form onSubmit={handleSubmit(d => placeOrder.mutate(d))} className="space-y-4">
          <div className="bg-white rounded-2xl border border-gray-200 p-4 space-y-4">
            <h2 className="font-medium text-gray-900 text-sm">Delivery address</h2>
            <Input {...register('addressLine')} label="Street address" placeholder="123 Rizal St" error={errors.addressLine?.message} />
            <Input {...register('barangay')} label="Barangay" placeholder="Brgy. San Isidro" error={errors.barangay?.message} />
            <div>
              <label className="text-sm font-medium text-gray-700">Notes (optional)</label>
              <textarea
                {...register('notes')}
                rows={2}
                placeholder="Delivery instructions…"
                className="mt-1 w-full rounded-xl border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 resize-none"
              />
            </div>
          </div>

          {placeOrder.error && (
            <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{placeOrder.error.message}</p>
          )}

          <Button type="submit" className="w-full" size="lg" loading={placeOrder.isPending}>
            Place order
          </Button>
        </form>
      </main>
    </>
  )
}
