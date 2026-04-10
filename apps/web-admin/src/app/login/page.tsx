'use client'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { Shield } from 'lucide-react'
import { api } from '@ebalangay/shared'
import { useAuthStore } from '@/stores/auth-store'

const schema = z.object({
  phone: z.string().min(1),
  password: z.string().min(1),
})
type F = z.infer<typeof schema>

export default function AdminLoginPage() {
  const router = useRouter()
  const { setAuth } = useAuthStore()
  const [error, setError] = useState('')
  const { register, handleSubmit, formState: { isSubmitting } } = useForm<F>({ resolver: zodResolver(schema) })

  async function onSubmit(data: F) {
    setError('')
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      })
      const json = await res.json() as { success: boolean; error?: string }
      if (!res.ok || !json.success) throw new Error(json.error ?? 'Login failed')
      const result = await api.auth.login(data)
      if (result.user.role !== 'ADMIN') throw new Error('Admin access only')
      setAuth(result.user, result.accessToken)
      router.push('/')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed')
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-950 px-4">
      <div className="w-full max-w-sm">
        <div className="flex flex-col items-center mb-8">
          <Shield className="h-10 w-10 text-brand-500 mb-3" />
          <h1 className="text-2xl font-bold text-white">Admin Portal</h1>
          <p className="text-gray-500 text-sm">eBalangay operations</p>
        </div>
        <div className="bg-gray-900 rounded-2xl border border-gray-800 p-6">
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div>
              <label className="text-sm font-medium text-gray-400">Phone</label>
              <input {...register('phone')} placeholder="09XXXXXXXXX" className="mt-1 w-full h-10 rounded-lg bg-gray-800 border border-gray-700 px-3 text-sm text-white placeholder:text-gray-600 focus:outline-none focus:ring-2 focus:ring-brand-500" />
            </div>
            <div>
              <label className="text-sm font-medium text-gray-400">Password</label>
              <input {...register('password')} type="password" placeholder="••••••••" className="mt-1 w-full h-10 rounded-lg bg-gray-800 border border-gray-700 px-3 text-sm text-white placeholder:text-gray-600 focus:outline-none focus:ring-2 focus:ring-brand-500" />
            </div>
            {error && <p className="text-sm text-red-400 bg-red-900/20 rounded-lg px-3 py-2">{error}</p>}
            <button type="submit" disabled={isSubmitting} className="w-full h-10 rounded-lg bg-brand-600 text-white text-sm font-medium hover:bg-brand-700 disabled:opacity-50 transition-colors">
              {isSubmitting ? 'Signing in…' : 'Sign in'}
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}
