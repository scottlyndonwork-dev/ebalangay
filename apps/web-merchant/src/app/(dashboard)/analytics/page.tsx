'use client'
import { useQuery } from '@tanstack/react-query'
import { useAuthStore } from '@/stores/auth-store'
import { api } from '@ebalangay/shared'
import { formatPeso } from '@/lib/utils'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { SalesChart } from '@/components/analytics/sales-chart'
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
} from 'recharts'

export default function AnalyticsPage() {
  const { accessToken } = useAuthStore()

  const { data, isLoading } = useQuery({
    queryKey: ['merchant-dashboard'],
    queryFn: () => api.analytics.getMerchantDashboard(accessToken!),
    enabled: !!accessToken,
  })

  return (
    <div className="p-6 space-y-6">
      <h1 className="text-xl font-semibold text-gray-900">Analytics</h1>

      {isLoading && (
        <div className="space-y-4">{[...Array(3)].map((_, i) => <div key={i} className="h-48 rounded-xl bg-gray-200 animate-pulse" />)}</div>
      )}

      {data && (
        <>
          <div className="grid grid-cols-2 gap-4">
            <Card>
              <CardContent className="pt-5">
                <p className="text-2xl font-bold text-gray-900">{data.todayOrders}</p>
                <p className="text-sm text-gray-500">Orders today</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-5">
                <p className="text-2xl font-bold text-gray-900">{formatPeso(data.todayRevenue)}</p>
                <p className="text-sm text-gray-500">Revenue today</p>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader><CardTitle>Daily revenue — last 30 days</CardTitle></CardHeader>
            <CardContent>
              <SalesChart data={data.dailyRevenue} />
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>Top selling products</CardTitle></CardHeader>
            <CardContent>
              {data.topProducts.length === 0 ? (
                <p className="text-sm text-gray-400">No data yet</p>
              ) : (
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={data.topProducts} layout="vertical" margin={{ left: 16, right: 16 }}>
                    <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                    <XAxis type="number" tick={{ fontSize: 11, fill: '#9ca3af' }} tickLine={false} axisLine={false} />
                    <YAxis dataKey="name" type="category" tick={{ fontSize: 11, fill: '#374151' }} tickLine={false} axisLine={false} width={100} />
                    <Tooltip contentStyle={{ borderRadius: 8, fontSize: 12 }} />
                    <Bar dataKey="totalSold" fill="#16a34a" radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  )
}
