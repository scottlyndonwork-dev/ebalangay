'use client'
import { useQuery } from '@tanstack/react-query'
import { useParams } from 'next/navigation'
import Image from 'next/image'
import { ShoppingCart, Plus, Minus, ArrowLeft } from 'lucide-react'
import Link from 'next/link'
import { api, type Product } from '@ebalangay/shared'
import { useCartStore } from '@/stores/cart-store'
import { useAuthStore } from '@/stores/auth-store'
import { Navbar } from '@/components/layout/navbar'
import { Button } from '@/components/ui/button'
import { formatPeso } from '@/lib/utils'
import { SupportChat } from '@/components/chat/support-chat'

export default function MerchantPage() {
  const { id } = useParams<{ id: string }>()

  const { data: merchant } = useQuery({
    queryKey: ['merchant', id],
    queryFn: () => api.businesses.get(id),
  })

  const { data: productsData, isLoading } = useQuery({
    queryKey: ['products', id],
    queryFn: () => api.products.list({ businessId: id }),
  })

  const products = productsData?.products ?? []
  const categories = [...new Set(products.map(p => p.category))]

  return (
    <>
      <Navbar />
      <main className="max-w-5xl mx-auto px-4 py-6 space-y-6">
        <Link href="/" className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700">
          <ArrowLeft className="h-4 w-4" /> Back
        </Link>

        {/* Store header */}
        <div className="flex items-center gap-4">
          <div className="h-16 w-16 rounded-xl bg-gray-100 overflow-hidden flex-shrink-0">
            {merchant?.logoUrl ? (
              <Image src={merchant.logoUrl} alt={merchant.name ?? ''} width={64} height={64} className="object-cover w-full h-full" />
            ) : (
              <div className="flex items-center justify-center h-full text-gray-300 text-2xl">🏪</div>
            )}
          </div>
          <div>
            <h1 className="text-xl font-bold text-gray-900">{merchant?.name}</h1>
            <p className="text-sm text-gray-500">{merchant?.barangay}, {merchant?.city}</p>
          </div>
        </div>

        {isLoading && (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
            {[...Array(8)].map((_, i) => <div key={i} className="h-52 rounded-2xl bg-gray-200 animate-pulse" />)}
          </div>
        )}

        {categories.map(cat => (
          <div key={cat}>
            <h2 className="font-semibold text-gray-700 mb-3">{cat}</h2>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
              {products.filter(p => p.category === cat && p.isActive).map(p => (
                <ProductCard key={p.id} product={p} />
              ))}
            </div>
          </div>
        ))}
      </main>
      <SupportChat />
    </>
  )
}

function ProductCard({ product }: { product: Product }) {
  const { items, addItem, removeItem, updateQty } = useCartStore()
  const cartItem = items.find(i => i.product.id === product.id)
  const qty = cartItem?.quantity ?? 0

  return (
    <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
      <div className="relative h-32 bg-gray-100">
        {product.imageUrl ? (
          <Image src={product.imageUrl} alt={product.name} fill className="object-cover" />
        ) : (
          <div className="flex items-center justify-center h-full text-gray-300 text-3xl">🛍</div>
        )}
      </div>
      <div className="p-3">
        <p className="text-sm font-medium text-gray-900 line-clamp-1">{product.name}</p>
        <p className="text-brand-700 font-semibold text-sm mt-0.5">{formatPeso(product.price)}</p>
        {product.stockQty === 0 ? (
          <p className="text-xs text-red-500 mt-2">Out of stock</p>
        ) : qty === 0 ? (
          <Button size="sm" className="w-full mt-2" onClick={() => addItem(product)}>
            <ShoppingCart className="h-3.5 w-3.5" /> Add
          </Button>
        ) : (
          <div className="flex items-center justify-between mt-2">
            <button
              onClick={() => qty === 1 ? removeItem(product.id) : updateQty(product.id, qty - 1)}
              className="h-7 w-7 rounded-full bg-gray-100 flex items-center justify-center hover:bg-gray-200"
            >
              <Minus className="h-3 w-3" />
            </button>
            <span className="text-sm font-semibold">{qty}</span>
            <button
              onClick={() => updateQty(product.id, qty + 1)}
              className="h-7 w-7 rounded-full bg-brand-600 text-white flex items-center justify-center hover:bg-brand-700"
            >
              <Plus className="h-3 w-3" />
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
