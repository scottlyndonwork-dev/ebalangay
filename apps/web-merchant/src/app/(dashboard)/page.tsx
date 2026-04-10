'use client'
import { useQuery } from '@tanstack/react-query'
import { ShoppingCart, TrendingUp, Clock, AlertTriangle } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { useAuthStore } from '@/stores/auth-store'
import { api } from '@ebalangay/shared'
import { formatPeso } from '@/lib/utils'
import { SalesChart } from '@/components/analytics/sales-chart'

function StatCard({
  title, value, icon: Icon, color,
}: {
  title: string
  value: string | number
  icon: React.ElementType
  color: string
}) {
  return (
    <Card>
      <CardContent className="flex items-center gap-4 pt-5">
        <div className={`h-12 w-12 rounded-xl flex items-center justify-center ${color}`}>
          <Icon className="h-6 w-6" />
        </div>
        <div>
          <p className="text-2xl font-bold text-gray-900">{value}</p>
          <p className="text-sm text-gray-500">{title}</p>
        </div>
      </CardContent>
    </Card>
  )
}

export default function DashboardPage() {
  const { accessToken } = useAuthStore()

  const { data, isLoading } = useQuery({
    queryKey: ['merchant-dashboard'],
    queryFn: () => api.analytics.getMerchantDashboard(accessToken!),
    enabled: !!accessToken,
    refetchInterval: 30_000,
  })

  if (isLoading) {
    return (
      <div className="p-6 space-y-4">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="h-24 rounded-xl bg-gray-200 animate-pulse" />
        ))}
      </div>
    )
  }

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-gray-900">Dashboard</h1>
        <p className="text-sm text-gray-500">Your store at a glance</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <StatCard
          title="Today's orders"
          value={data?.todayOrders ?? 0}
          icon={ShoppingCart}
          color="bg-blue-50 text-blue-600"
        />
        <StatCard
          title="Today's revenue"
          value={formatPeso(data?.todayRevenue ?? 0)}
          icon={TrendingUp}
          color="bg-green-50 text-green-600"
        />
        <StatCard
          title="Pending orders"
          value={data?.pendingOrders ?? 0}
          icon={Clock}
          color="bg-yellow-50 text-yellow-600"
        />
        <StatCard
          title="Low stock items"
          value={data?.lowStockCount ?? 0}
          icon={AlertTriangle}
          color="bg-red-50 text-red-600"
        />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        <div className="xl:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle>Revenue — last 30 days</CardTitle>
            </CardHeader>
            <CardContent>
              <SalesChart data={data?.dailyRevenue ?? []} />
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Top products</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {(data?.topProducts ?? []).length === 0 && (
              <p className="text-sm text-gray-400">No data yet</p>
            )}
            {(data?.topProducts ?? []).map((p, i) => (
              <div key={p.name} className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-medium text-gray-400 w-4">{i + 1}</span>
                  <span className="text-sm text-gray-700">{p.name}</span>
                </div>
                <span className="text-sm font-medium text-gray-900">{p.totalSold} sold</span>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
