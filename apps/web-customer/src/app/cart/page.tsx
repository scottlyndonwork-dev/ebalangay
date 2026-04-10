'use client'
import Link from 'next/link'
import Image from 'next/image'
import { Trash2, Plus, Minus, ArrowRight } from 'lucide-react'
import { Navbar } from '@/components/layout/navbar'
import { Button } from '@/components/ui/button'
import { useCartStore } from '@/stores/cart-store'
import { formatPeso } from '@/lib/utils'

export default function CartPage() {
  const { items, removeItem, updateQty, total, clearCart } = useCartStore()

  if (items.length === 0) {
    return (
      <>
        <Navbar />
        <div className="max-w-xl mx-auto px-4 py-16 text-center">
          <p className="text-4xl mb-4">🛒</p>
          <h2 className="text-xl font-semibold text-gray-900 mb-2">Your cart is empty</h2>
          <p className="text-gray-500 mb-6">Browse local stores and add items to get started.</p>
          <Link href="/"><Button>Browse stores</Button></Link>
        </div>
      </>
    )
  }

  return (
    <>
      <Navbar />
      <main className="max-w-xl mx-auto px-4 py-6 space-y-4">
        <h1 className="text-xl font-semibold text-gray-900">Your cart</h1>

        <div className="bg-white rounded-2xl border border-gray-200 divide-y divide-gray-100">
          {items.map(({ product, quantity }) => (
            <div key={product.id} className="flex items-center gap-3 p-4">
              <div className="h-14 w-14 rounded-xl bg-gray-100 overflow-hidden flex-shrink-0">
                {product.imageUrl ? (
                  <Image src={product.imageUrl} alt={product.name} width={56} height={56} className="object-cover w-full h-full" />
                ) : (
                  <div className="flex items-center justify-center h-full text-gray-300 text-xl">🛍</div>
                )}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-900 truncate">{product.name}</p>
                <p className="text-sm text-brand-700 font-semibold">{formatPeso(product.price)}</p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => quantity === 1 ? removeItem(product.id) : updateQty(product.id, quantity - 1)}
                  className="h-7 w-7 rounded-full bg-gray-100 flex items-center justify-center hover:bg-gray-200"
                >
                  <Minus className="h-3 w-3" />
                </button>
                <span className="text-sm font-semibold w-4 text-center">{quantity}</span>
                <button
                  onClick={() => updateQty(product.id, quantity + 1)}
                  className="h-7 w-7 rounded-full bg-brand-600 text-white flex items-center justify-center hover:bg-brand-700"
                >
                  <Plus className="h-3 w-3" />
                </button>
                <button onClick={() => removeItem(product.id)} className="ml-1 text-gray-400 hover:text-red-500">
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </div>
          ))}
        </div>

        <div className="bg-white rounded-2xl border border-gray-200 p-4 space-y-2">
          <div className="flex justify-between text-sm text-gray-600">
            <span>Subtotal</span><span>{formatPeso(total())}</span>
          </div>
          <div className="flex justify-between text-sm text-gray-400">
            <span>Delivery fee</span><span>Calculated at checkout</span>
          </div>
          <div className="flex justify-between font-semibold text-gray-900 pt-2 border-t">
            <span>Total (excl. delivery)</span><span>{formatPeso(total())}</span>
          </div>
        </div>

        <Link href="/checkout">
          <Button className="w-full" size="lg">
            Proceed to checkout <ArrowRight className="h-4 w-4" />
          </Button>
        </Link>
        <button onClick={clearCart} className="w-full text-sm text-gray-400 hover:text-gray-600">
          Clear cart
        </button>
      </main>
    </>
  )
}
