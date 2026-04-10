'use client'
import { useQuery } from '@tanstack/react-query'
import { useAuthStore } from '@/stores/auth-store'
import { api, type Business } from '@ebalangay/shared'

export default function MerchantsPage() {
  const { accessToken } = useAuthStore()

  const { data: merchants, isLoading } = useQuery({
    queryKey: ['admin-merchants'],
    queryFn: () => api.businesses.list(undefined, accessToken!),
    enabled: !!accessToken,
  })

  return (
    <div className="p-6 space-y-5">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold text-gray-900">Merchants</h1>
        <span className="text-sm text-gray-500">{(merchants ?? []).length} total</span>
      </div>

      {isLoading && <div className="space-y-2">{[...Array(6)].map((_, i) => <div key={i} className="h-12 rounded-lg bg-gray-200 animate-pulse" />)}</div>}

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="text-left py-3 px-4 text-xs font-medium text-gray-500">Store</th>
              <th className="text-left py-3 px-4 text-xs font-medium text-gray-500">Type</th>
              <th className="text-left py-3 px-4 text-xs font-medium text-gray-500">Location</th>
              <th className="text-left py-3 px-4 text-xs font-medium text-gray-500">Verified</th>
              <th className="text-left py-3 px-4 text-xs font-medium text-gray-500">B2B</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {(merchants ?? []).map((m: Business) => (
              <tr key={m.id} className="hover:bg-gray-50">
                <td className="py-3 px-4 font-medium text-gray-900">{m.name}</td>
                <td className="py-3 px-4 text-gray-600">{m.type}</td>
                <td className="py-3 px-4 text-gray-500">{m.barangay}, {m.city}</td>
                <td className="py-3 px-4">
                  <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium ${m.isVerified ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'}`}>
                    {m.isVerified ? 'Verified' : 'Pending'}
                  </span>
                </td>
                <td className="py-3 px-4 text-gray-500">{m.canSellB2B ? '✓' : '—'}</td>
              </tr>
            ))}
            {!isLoading && (merchants ?? []).length === 0 && (
              <tr><td colSpan={5} className="py-8 text-center text-gray-400">No merchants</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
