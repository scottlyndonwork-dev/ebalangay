'use client'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { ShoppingCart, User, LogOut, Search, Home } from 'lucide-react'
import { useAuthStore } from '@/stores/auth-store'
import { useCartStore } from '@/stores/cart-store'

export function Navbar() {
  const { user, clearAuth } = useAuthStore()
  const itemCount = useCartStore(s => s.itemCount())
  const router = useRouter()

  async function logout() {
    await fetch('/api/auth/logout', { method: 'POST' })
    clearAuth()
    router.push('/')
  }

  return (
    <header className="sticky top-0 z-40 bg-white border-b border-gray-200">
      <div className="max-w-5xl mx-auto px-4 h-14 flex items-center justify-between gap-4">
        <Link href="/" className="flex items-center gap-1.5 font-bold text-gray-900">
          <Home className="h-5 w-5 text-brand-600" />
          eBalangay
        </Link>

        <Link href="/search" className="flex-1 max-w-sm">
          <div className="flex items-center gap-2 h-9 rounded-full bg-gray-100 px-3 text-sm text-gray-400 cursor-pointer hover:bg-gray-200 transition-colors">
            <Search className="h-4 w-4" />
            Search stores and products…
          </div>
        </Link>

        <nav className="flex items-center gap-2">
          <Link href="/cart" className="relative flex items-center justify-center h-9 w-9 rounded-full hover:bg-gray-100 transition-colors">
            <ShoppingCart className="h-5 w-5 text-gray-600" />
            {itemCount > 0 && (
              <span className="absolute -top-0.5 -right-0.5 h-4 w-4 rounded-full bg-brand-600 text-white text-[10px] font-bold flex items-center justify-center">
                {itemCount > 9 ? '9+' : itemCount}
              </span>
            )}
          </Link>

          {user ? (
            <>
              <Link href="/orders" className="flex items-center justify-center h-9 w-9 rounded-full hover:bg-gray-100 transition-colors">
                <User className="h-5 w-5 text-gray-600" />
              </Link>
              <button onClick={logout} className="flex items-center justify-center h-9 w-9 rounded-full hover:bg-gray-100 transition-colors">
                <LogOut className="h-4 w-4 text-gray-500" />
              </button>
            </>
          ) : (
            <Link href="/login" className="h-9 px-4 rounded-full bg-brand-600 text-white text-sm font-medium flex items-center hover:bg-brand-700 transition-colors">
              Sign in
            </Link>
          )}
        </nav>
      </div>
    </header>
  )
}
