'use client'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useParams, useRouter } from 'next/navigation'
import { ArrowLeft } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { ProductForm, type ProductFormData } from '@/components/products/product-form'
import { useAuthStore } from '@/stores/auth-store'
import { api } from '@ebalangay/shared'

export default function EditProductPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const { accessToken } = useAuthStore()
  const qc = useQueryClient()

  const { data: product, isLoading } = useQuery({
    queryKey: ['product', id],
    queryFn: () => api.products.get(id, accessToken),
    enabled: !!accessToken,
  })

  const update = useMutation({
    mutationFn: (data: ProductFormData) =>
      api.products.update(id, { ...data, price: Number(data.price) }, accessToken!),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['products'] })
      qc.invalidateQueries({ queryKey: ['product', id] })
      router.push('/products')
    },
  })

  if (isLoading) return <div className="p-6 text-gray-400">Loading…</div>

  return (
    <div className="p-6 max-w-xl space-y-5">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" onClick={() => router.back()}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <h1 className="text-xl font-semibold">Edit product</h1>
      </div>
      <Card>
        <CardHeader><CardTitle>{product?.name}</CardTitle></CardHeader>
        <CardContent>
          {product && (
            <ProductForm
              productId={id}
              defaultValues={{
                name: product.name,
                description: product.description,
                price: product.price,
                stockQty: product.stockQty,
                reorderAt: product.reorderAt,
                category: product.category,
                sku: product.sku,
                isB2B: product.isB2B,
              }}
              onSubmit={(data) => update.mutateAsync(data)}
              isSubmitting={update.isPending}
            />
          )}
        </CardContent>
      </Card>
    </div>
  )
}
