'use client'
import { useQuery } from '@tanstack/react-query'
import { useAuthStore } from '@/stores/auth-store'
import { api } from '@ebalangay/shared'
import { formatPeso } from '@/lib/utils'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend,
} from 'recharts'

const COLORS = ['#16a34a', '#2563eb', '#f59e0b', '#ef4444', '#8b5cf6']

export default function AdminAnalyticsPage() {
  const { accessToken } = useAuthStore()
  const { data, isLoading } = useQuery({
    queryKey: ['admin-dashboard'],
    queryFn: () => api.analytics.getAdminDashboard(accessToken!),
    enabled: !!accessToken,
  })

  return (
    <div className="p-6 space-y-6">
      <h1 className="text-xl font-semibold text-gray-900">Analytics</h1>

      {isLoading && <div className="space-y-4">{[...Array(3)].map((_, i) => <div key={i} className="h-52 rounded-xl bg-gray-200 animate-pulse" />)}</div>}

      {data && (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {[
              { label: 'Gross Merchandise Value', value: formatPeso(data.gmv) },
              { label: 'Total orders', value: data.totalOrders.toLocaleString() },
              { label: 'Registered merchants', value: data.totalMerchants.toLocaleString() },
            ].map(s => (
              <div key={s.label} className="bg-white rounded-xl border border-gray-200 p-5">
                <p className="text-2xl font-bold text-gray-900">{s.value}</p>
                <p className="text-sm text-gray-500 mt-0.5">{s.label}</p>
              </div>
            ))}
          </div>

          {data.revenueByStream.length > 0 && (
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
              <div className="bg-white rounded-xl border border-gray-200 p-5">
                <h2 className="font-semibold text-gray-900 mb-4">Revenue by stream (bar)</h2>
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={data.revenueByStream}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                    <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#9ca3af' }} tickLine={false} axisLine={false} />
                    <YAxis tickFormatter={(v: number) => `₱${(v/1000).toFixed(0)}k`} tick={{ fontSize: 11, fill: '#9ca3af' }} tickLine={false} axisLine={false} />
                    <Tooltip formatter={(v: number) => formatPeso(v)} contentStyle={{ borderRadius: 8, fontSize: 12 }} />
                    <Bar dataKey="value" fill="#16a34a" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>

              <div className="bg-white rounded-xl border border-gray-200 p-5">
                <h2 className="font-semibold text-gray-900 mb-4">Revenue by stream (pie)</h2>
                <ResponsiveContainer width="100%" height={220}>
                  <PieChart>
                    <Pie data={data.revenueByStream} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80}>
                      {data.revenueByStream.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                    </Pie>
                    <Tooltip formatter={(v: number) => formatPeso(v)} />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}
