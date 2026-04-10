'use client'
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts'
import { formatShortDate } from '@/lib/utils'

interface Props {
  data: Array<{ date: string; revenue: number }>
}

export function SalesChart({ data }: Props) {
  if (data.length === 0) {
    return <div className="h-48 flex items-center justify-center text-sm text-gray-400">No data yet</div>
  }
  return (
    <ResponsiveContainer width="100%" height={220}>
      <LineChart data={data} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
        <XAxis
          dataKey="date"
          tickFormatter={formatShortDate}
          tick={{ fontSize: 11, fill: '#9ca3af' }}
          tickLine={false}
          axisLine={false}
        />
        <YAxis
          tickFormatter={(v: number) => `₱${(v / 1000).toFixed(0)}k`}
          tick={{ fontSize: 11, fill: '#9ca3af' }}
          tickLine={false}
          axisLine={false}
          width={45}
        />
        <Tooltip
          formatter={(value: number) => [`₱${value.toLocaleString('en-PH', { minimumFractionDigits: 2 })}`, 'Revenue']}
          labelFormatter={formatShortDate}
          contentStyle={{ borderRadius: 8, border: '1px solid #e5e7eb', fontSize: 12 }}
        />
        <Line
          type="monotone"
          dataKey="revenue"
          stroke="#16a34a"
          strokeWidth={2}
          dot={false}
          activeDot={{ r: 4 }}
        />
      </LineChart>
    </ResponsiveContainer>
  )
}
