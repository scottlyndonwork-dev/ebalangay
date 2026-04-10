'use client'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useState, useRef } from 'react'
import { Sparkles, Upload } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useAuthStore } from '@/stores/auth-store'
import { api } from '@ebalangay/shared'
import type { Product } from '@ebalangay/shared'

const schema = z.object({
  name: z.string().min(1, 'Name is required').max(200),
  description: z.string().max(1000).optional(),
  price: z.coerce.number().positive('Price must be positive'),
  stockQty: z.coerce.number().int().min(0),
  reorderAt: z.coerce.number().int().min(0).default(5),
  category: z.string().min(1, 'Category is required'),
  sku: z.string().optional(),
  isB2B: z.boolean().default(false),
})
export type ProductFormData = z.infer<typeof schema>

interface Props {
  defaultValues?: Partial<ProductFormData>
  productId?: string
  onSubmit: (data: ProductFormData) => Promise<void>
  isSubmitting: boolean
}

export function ProductForm({ defaultValues, productId, onSubmit, isSubmitting }: Props) {
  const { accessToken } = useAuthStore()
  const [aiLoading, setAiLoading] = useState(false)
  const [uploading, setUploading] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  const { register, handleSubmit, setValue, watch, formState: { errors } } = useForm<ProductFormData>({
    resolver: zodResolver(schema),
    defaultValues: { reorderAt: 5, isB2B: false, stockQty: 0, ...defaultValues },
  })

  const name = watch('name')
  const category = watch('category')
  const price = watch('price')

  async function generateDescription() {
    if (!name || !category || !price) return
    setAiLoading(true)
    try {
      const desc = await api.ai.getDescription(name, category, Number(price), accessToken!)
      setValue('description', desc)
    } finally {
      setAiLoading(false)
    }
  }

  async function handleImageUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file || !productId) return
    setUploading(true)
    try {
      const fd = new FormData()
      fd.append('image', file)
      await api.products.uploadImage(productId, fd, accessToken!)
    } finally {
      setUploading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <Input {...register('name')} label="Product name" placeholder="Crispy Pata" error={errors.name?.message} />
      <Input {...register('category')} label="Category" placeholder="Food, Drinks, Grocery..." error={errors.category?.message} />

      <div className="flex flex-col gap-1">
        <label className="text-sm font-medium text-gray-700">Description</label>
        <div className="relative">
          <textarea
            {...register('description')}
            rows={3}
            placeholder="Describe your product..."
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 resize-none"
          />
          <button
            type="button"
            onClick={generateDescription}
            disabled={aiLoading || !name}
            className="absolute bottom-2 right-2 flex items-center gap-1 text-xs text-brand-600 bg-brand-50 hover:bg-brand-100 rounded-md px-2 py-1 disabled:opacity-40 transition-colors"
          >
            <Sparkles className="h-3 w-3" />
            {aiLoading ? 'Generating…' : 'AI suggest'}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <Input {...register('price')} label="Price (₱)" type="number" step="0.01" min="0" placeholder="0.00" error={errors.price?.message} />
        <Input {...register('stockQty')} label="Stock qty" type="number" min="0" placeholder="0" error={errors.stockQty?.message} />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <Input {...register('reorderAt')} label="Reorder at" type="number" min="0" placeholder="5" error={errors.reorderAt?.message} />
        <Input {...register('sku')} label="SKU (optional)" placeholder="ABC-001" error={errors.sku?.message} />
      </div>

      <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer select-none">
        <input type="checkbox" {...register('isB2B')} className="rounded" />
        Available for B2B / wholesale orders
      </label>

      {productId && (
        <div>
          <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleImageUpload} />
          <Button type="button" variant="secondary" size="sm" onClick={() => fileRef.current?.click()} loading={uploading}>
            <Upload className="h-4 w-4" />
            {uploading ? 'Uploading…' : 'Upload image'}
          </Button>
        </div>
      )}

      <Button type="submit" loading={isSubmitting} className="w-full">
        Save product
      </Button>
    </form>
  )
}
