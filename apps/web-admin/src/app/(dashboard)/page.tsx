'use client'
import { useQuery } from '@tanstack/react-query'
import { useAuthStore } from '@/stores/auth-store'
import { api } from '@ebalangay/shared'
import { formatPeso } from '@/lib/utils'
import { TrendingUp, ShoppingCart, Bike, Store } from 'lucide-react'
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend } from 'recharts'

function Stat({ label, value, icon: Icon }: { label: string; value: string | number; icon: React.ElementType }) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5 flex items-center gap-4">
      <div className="h-11 w-11 rounded-xl bg-brand-50 flex items-center justify-center">
        <Icon className="h-5 w-5 text-brand-600" />
      </div>
      <div>
        <p className="text-2xl font-bold text-gray-900">{value}</p>
        <p className="text-sm text-gray-500">{label}</p>
      </div>
    </div>
  )
}

const PIE_COLORS = ['#16a34a', '#2563eb', '#f59e0b', '#ef4444']

export default function AdminOverviewPage() {
  const { accessToken } = useAuthStore()
  const { data, isLoading } = useQuery({
    queryKey: ['admin-dashboard'],
    queryFn: () => api.analytics.getAdminDashboard(accessToken!),
    enabled: !!accessToken,
    refetchInterval: 30_000,
  })

  return (
    <div className="p-6 space-y-6">
      <h1 className="text-xl font-semibold text-gray-900">Overview</h1>

      {isLoading && <div className="grid grid-cols-4 gap-4">{[...Array(4)].map((_, i) => <div key={i} className="h-20 rounded-xl bg-gray-200 animate-pulse" />)}</div>}

      {data && (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
            <Stat label="Gross Merchandise Value" value={formatPeso(data.gmv)} icon={TrendingUp} />
            <Stat label="Total orders" value={data.totalOrders} icon={ShoppingCart} />
            <Stat label="Active riders" value={data.activeRiders} icon={Bike} />
            <Stat label="Merchants" value={data.totalMerchants} icon={Store} />
          </div>

          {data.revenueByStream.length > 0 && (
            <div className="bg-white rounded-xl border border-gray-200 p-5">
              <h2 className="font-semibold text-gray-900 mb-4">Revenue streams</h2>
              <ResponsiveContainer width="100%" height={240}>
                <PieChart>
                  <Pie data={data.revenueByStream} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={90} label={({ name, percent }: { name: string; percent: number }) => `${name} ${(percent * 100).toFixed(0)}%`}>
                    {data.revenueByStream.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                  </Pie>
                  <Tooltip formatter={(v: number) => formatPeso(v)} />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            </div>
          )}
        </>
      )}
    </div>
  )
}
