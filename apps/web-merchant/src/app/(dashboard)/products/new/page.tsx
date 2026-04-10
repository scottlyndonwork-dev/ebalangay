'use client'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useRouter } from 'next/navigation'
import { ArrowLeft } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { ProductForm, type ProductFormData } from '@/components/products/product-form'
import { useAuthStore } from '@/stores/auth-store'
import { api } from '@ebalangay/shared'

export default function NewProductPage() {
  const router = useRouter()
  const { accessToken } = useAuthStore()
  const qc = useQueryClient()

  const create = useMutation({
    mutationFn: (data: ProductFormData) =>
      api.products.create({ ...data, price: Number(data.price) }, accessToken!),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['products'] })
      router.push('/products')
    },
  })

  return (
    <div className="p-6 max-w-xl space-y-5">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" onClick={() => router.back()}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <h1 className="text-xl font-semibold">Add product</h1>
      </div>
      <Card>
        <CardHeader><CardTitle>Product details</CardTitle></CardHeader>
        <CardContent>
          <ProductForm
            onSubmit={(data) => create.mutateAsync(data)}
            isSubmitting={create.isPending}
          />
          {create.error && (
            <p className="text-sm text-red-600 mt-2">{create.error.message}</p>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
