'use client'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { LayoutDashboard, Users, ShoppingCart, Map, BarChart3, Store, Settings, LogOut, Shield } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useAuthStore } from '@/stores/auth-store'

const nav = [
  { href: '/', icon: LayoutDashboard, label: 'Overview' },
  { href: '/users', icon: Users, label: 'Users' },
  { href: '/orders', icon: ShoppingCart, label: 'Orders' },
  { href: '/merchants', icon: Store, label: 'Merchants' },
  { href: '/map', icon: Map, label: 'Live map' },
  { href: '/analytics', icon: BarChart3, label: 'Analytics' },
  { href: '/settings', icon: Settings, label: 'Settings' },
]

export function AdminSidebar() {
  const pathname = usePathname()
  const router = useRouter()
  const { clearAuth } = useAuthStore()

  async function logout() {
    await fetch('/api/auth/logout', { method: 'POST' })
    clearAuth()
    router.push('/login')
  }

  return (
    <aside className="flex flex-col w-56 min-h-screen bg-gray-900 text-gray-300">
      <div className="flex items-center gap-2 h-16 px-5 border-b border-gray-800">
        <Shield className="h-5 w-5 text-brand-400" />
        <span className="font-bold text-white text-sm">eBalangay Admin</span>
      </div>
      <nav className="flex-1 p-3 space-y-0.5">
        {nav.map(item => {
          const active = pathname === item.href || (item.href !== '/' && pathname.startsWith(item.href))
          return (
            <Link key={item.href} href={item.href}
              className={cn('flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors',
                active ? 'bg-gray-800 text-white' : 'hover:bg-gray-800 hover:text-white'
              )}
            >
              <item.icon className="h-4 w-4 shrink-0" />
              {item.label}
            </Link>
          )
        })}
      </nav>
      <div className="p-3 border-t border-gray-800">
        <button onClick={logout} className="flex items-center gap-3 px-3 py-2 w-full rounded-lg text-sm text-gray-400 hover:bg-gray-800 hover:text-white transition-colors">
          <LogOut className="h-4 w-4" /> Sign out
        </button>
      </div>
    </aside>
  )
}
