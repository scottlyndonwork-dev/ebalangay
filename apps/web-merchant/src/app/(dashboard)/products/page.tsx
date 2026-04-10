'use client'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import Link from 'next/link'
import Image from 'next/image'
import { Plus, Pencil, Trash2 } from 'lucide-react'
import { useAuthStore } from '@/stores/auth-store'
import { api, type Product } from '@ebalangay/shared'
import { formatPeso } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'

export default function ProductsPage() {
  const { accessToken, user } = useAuthStore()
  const qc = useQueryClient()

  const { data, isLoading } = useQuery({
    queryKey: ['products'],
    queryFn: () => api.products.list({ businessId: user?.business?.id }, accessToken),
    enabled: !!accessToken && !!user?.business?.id,
  })

  const del = useMutation({
    mutationFn: (id: string) => api.products.delete(id, accessToken!),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['products'] }),
  })

  const products = data?.products ?? []

  return (
    <div className="p-6 space-y-5">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold text-gray-900">Products</h1>
        <Link href="/products/new">
          <Button size="sm"><Plus className="h-4 w-4" />Add product</Button>
        </Link>
      </div>

      {isLoading && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[...Array(6)].map((_, i) => <div key={i} className="h-56 rounded-xl bg-gray-200 animate-pulse" />)}
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {products.map((p: Product) => (
          <ProductCard key={p.id} product={p} onDelete={(id) => del.mutate(id)} />
        ))}
        {!isLoading && products.length === 0 && (
          <div className="col-span-3 text-center py-16 text-gray-400">
            No products yet. <Link href="/products/new" className="text-brand-600 underline">Add your first product</Link>
          </div>
        )}
      </div>
    </div>
  )
}

function ProductCard({ product, onDelete }: { product: Product; onDelete: (id: string) => void }) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
      <div className="relative h-36 bg-gray-100">
        {product.imageUrl ? (
          <Image src={product.imageUrl} alt={product.name} fill className="object-cover" />
        ) : (
          <div className="flex items-center justify-center h-full text-gray-300 text-xs">No image</div>
        )}
      </div>
      <div className="p-4">
        <div className="flex items-start justify-between gap-2">
          <div>
            <p className="font-medium text-gray-900 text-sm line-clamp-1">{product.name}</p>
            <p className="text-xs text-gray-500">{product.category}</p>
          </div>
          <Badge variant={product.stockQty <= product.reorderAt ? 'warning' : 'success'}>
            {product.stockQty} in stock
          </Badge>
        </div>
        <p className="text-brand-700 font-semibold mt-2">{formatPeso(product.price)}</p>
        <div className="flex gap-2 mt-3">
          <Link href={`/products/${product.id}/edit`} className="flex-1">
            <Button variant="secondary" size="sm" className="w-full">
              <Pencil className="h-3.5 w-3.5" />Edit
            </Button>
          </Link>
          <Button
            variant="ghost"
            size="sm"
            className="text-red-500 hover:bg-red-50"
            onClick={() => onDelete(product.id)}
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>
    </div>
  )
}
