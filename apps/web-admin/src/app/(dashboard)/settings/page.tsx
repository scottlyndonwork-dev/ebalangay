'use client'
import { useAuthStore } from '@/stores/auth-store'

export default function AdminSettingsPage() {
  const { user } = useAuthStore()
  return (
    <div className="p-6 space-y-5">
      <h1 className="text-xl font-semibold text-gray-900">Settings</h1>
      <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-3 max-w-md">
        <h2 className="font-medium text-gray-900">Admin account</h2>
        <div className="text-sm text-gray-600 space-y-1">
          <p>Name: <span className="font-medium text-gray-900">{user?.name}</span></p>
          <p>Phone: <span className="font-medium text-gray-900">{user?.phone}</span></p>
          <p>Role: <span className="font-medium text-gray-900">{user?.role}</span></p>
        </div>
      </div>
    </div>
  )
}
