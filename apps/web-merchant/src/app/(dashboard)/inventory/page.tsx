'use client'
import { useQuery } from '@tanstack/react-query'
import { useAuthStore } from '@/stores/auth-store'
import { api } from '@ebalangay/shared'
import { formatPeso } from '@/lib/utils'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Sparkles } from 'lucide-react'

export default function InventoryPage() {
  const { accessToken, user } = useAuthStore()

  const { data: products, isLoading: productsLoading } = useQuery({
    queryKey: ['products-inventory'],
    queryFn: () => api.products.list({ businessId: user?.business?.id }, accessToken),
    enabled: !!accessToken && !!user?.business?.id,
  })

  const { data: suggestions, isLoading: suggestionsLoading } = useQuery({
    queryKey: ['restock-suggestions'],
    queryFn: () => api.ai.getRestockSuggestions(accessToken!),
    enabled: !!accessToken,
  })

  const suggestionMap = new Map(
    (suggestions ?? []).map(s => [s.productId, s.suggestion])
  )

  const allProducts = products?.products ?? []
  const lowStock = allProducts.filter(p => p.stockQty <= p.reorderAt)
  const okStock = allProducts.filter(p => p.stockQty > p.reorderAt)

  return (
    <div className="p-6 space-y-6">
      <h1 className="text-xl font-semibold text-gray-900">Inventory</h1>

      {lowStock.length > 0 && (
        <div>
          <h2 className="text-sm font-semibold text-red-600 mb-3">⚠ Low stock ({lowStock.length})</h2>
          <div className="space-y-3">
            {lowStock.map(p => (
              <Card key={p.id} className="border-red-100">
                <CardContent className="pt-4">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="font-medium text-gray-900">{p.name}</p>
                      <p className="text-sm text-gray-500">{p.category} · {formatPeso(p.price)}</p>
                      <div className="flex items-center gap-2 mt-1">
                        <Badge variant="danger">{p.stockQty} remaining</Badge>
                        <span className="text-xs text-gray-400">reorder at {p.reorderAt}</span>
                      </div>
                    </div>
                  </div>
                  {suggestionMap.has(p.id) && (
                    <div className="mt-3 rounded-lg bg-brand-50 border border-brand-100 p-3 flex gap-2">
                      <Sparkles className="h-4 w-4 text-brand-600 shrink-0 mt-0.5" />
                      <p className="text-sm text-brand-800">{suggestionMap.get(p.id)}</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}

      <div>
        <h2 className="text-sm font-semibold text-gray-500 mb-3">All products ({allProducts.length})</h2>
        {(productsLoading || suggestionsLoading) && (
          <div className="space-y-2">{[...Array(5)].map((_, i) => <div key={i} className="h-12 rounded-lg bg-gray-200 animate-pulse" />)}</div>
        )}
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="text-left py-3 px-4 text-xs font-medium text-gray-500">Product</th>
                <th className="text-right py-3 px-4 text-xs font-medium text-gray-500">Stock</th>
                <th className="text-right py-3 px-4 text-xs font-medium text-gray-500">Reorder at</th>
                <th className="text-right py-3 px-4 text-xs font-medium text-gray-500">Price</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {allProducts.map(p => (
                <tr key={p.id} className="hover:bg-gray-50">
                  <td className="py-3 px-4">
                    <p className="font-medium text-gray-900">{p.name}</p>
                    <p className="text-xs text-gray-400">{p.category}</p>
                  </td>
                  <td className="py-3 px-4 text-right">
                    <span className={p.stockQty <= p.reorderAt ? 'text-red-600 font-medium' : 'text-gray-700'}>
                      {p.stockQty}
                    </span>
                  </td>
                  <td className="py-3 px-4 text-right text-gray-500">{p.reorderAt}</td>
                  <td className="py-3 px-4 text-right text-gray-700">{formatPeso(p.price)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
