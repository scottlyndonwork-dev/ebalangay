'use client'
import { useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import { Search } from 'lucide-react'
import { useAuthStore } from '@/stores/auth-store'
import { api, type User } from '@ebalangay/shared'
import { formatDate } from '@/lib/utils'

const ROLE_COLORS: Record<string, string> = {
  CUSTOMER: 'bg-blue-100 text-blue-800',
  MERCHANT: 'bg-green-100 text-green-800',
  RIDER: 'bg-orange-100 text-orange-800',
  ADMIN: 'bg-purple-100 text-purple-800',
}

export default function UsersPage() {
  const { accessToken } = useAuthStore()
  const [search, setSearch] = useState('')
  const [role, setRole] = useState('')

  const { data, isLoading } = useQuery({
    queryKey: ['admin-users', search, role],
    queryFn: () => api.users.list({ search: search || undefined, role: role || undefined }, accessToken!),
    enabled: !!accessToken,
  })

  const users = data?.users ?? []

  return (
    <div className="p-6 space-y-5">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold text-gray-900">Users</h1>
        <span className="text-sm text-gray-500">{data?.total ?? 0} total</span>
      </div>

      <div className="flex gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search by name or phone…"
            className="w-full h-9 pl-9 pr-3 rounded-lg border border-gray-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-brand-500" />
        </div>
        <select value={role} onChange={e => setRole(e.target.value)}
          className="h-9 px-3 rounded-lg border border-gray-200 bg-white text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-brand-500">
          <option value="">All roles</option>
          <option value="CUSTOMER">Customer</option>
          <option value="MERCHANT">Merchant</option>
          <option value="RIDER">Rider</option>
          <option value="ADMIN">Admin</option>
        </select>
      </div>

      {isLoading && <div className="space-y-2">{[...Array(8)].map((_, i) => <div key={i} className="h-12 rounded-lg bg-gray-200 animate-pulse" />)}</div>}

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="text-left py-3 px-4 text-xs font-medium text-gray-500">Name</th>
              <th className="text-left py-3 px-4 text-xs font-medium text-gray-500">Phone</th>
              <th className="text-left py-3 px-4 text-xs font-medium text-gray-500">Role</th>
              <th className="text-left py-3 px-4 text-xs font-medium text-gray-500">Verified</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {users.map((u: User) => (
              <tr key={u.id} className="hover:bg-gray-50">
                <td className="py-3 px-4 font-medium text-gray-900">{u.name}</td>
                <td className="py-3 px-4 text-gray-600">{u.phone}</td>
                <td className="py-3 px-4">
                  <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium ${ROLE_COLORS[u.role] ?? 'bg-gray-100 text-gray-700'}`}>
                    {u.role}
                  </span>
                </td>
                <td className="py-3 px-4 text-gray-500">{u.isVerified ? '✓' : '—'}</td>
              </tr>
            ))}
            {!isLoading && users.length === 0 && (
              <tr><td colSpan={4} className="py-8 text-center text-gray-400">No users found</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
