'use client'
import { useQuery } from '@tanstack/react-query'
import Link from 'next/link'
import Image from 'next/image'
import { MapPin, Store } from 'lucide-react'
import { Navbar } from '@/components/layout/navbar'
import { SupportChat } from '@/components/chat/support-chat'
import { api, type Business } from '@ebalangay/shared'

export default function HomePage() {
  const { data: merchants, isLoading } = useQuery({
    queryKey: ['merchants'],
    queryFn: () => api.businesses.list(),
    staleTime: 60_000,
  })

  const CATEGORY_LABELS: Record<string, string> = {
    RETAIL: 'Grocery / Retail',
    RESTAURANT: 'Food & Drinks',
    PHARMACY: 'Pharmacy',
    HARDWARE: 'Hardware',
    WHOLESALE: 'Wholesale',
    DISTRIBUTOR: 'Distributor',
  }

  return (
    <>
      <Navbar />
      <main className="max-w-5xl mx-auto px-4 py-6 space-y-6">
        {/* Hero */}
        <div className="rounded-2xl bg-gradient-to-br from-brand-600 to-brand-700 text-white p-8">
          <h1 className="text-2xl font-bold mb-1">Delivery from local stores</h1>
          <p className="text-brand-100 text-sm flex items-center gap-1">
            <MapPin className="h-4 w-4" /> Butuan City, Caraga
          </p>
        </div>

        {/* Merchants */}
        <div>
          <h2 className="font-semibold text-gray-900 mb-4">Nearby stores</h2>
          {isLoading && (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {[...Array(6)].map((_, i) => <div key={i} className="h-40 rounded-2xl bg-gray-200 animate-pulse" />)}
            </div>
          )}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {(merchants ?? []).map((m: Business) => (
              <MerchantCard key={m.id} merchant={m} categoryLabel={CATEGORY_LABELS[m.type] ?? m.type} />
            ))}
            {!isLoading && (merchants ?? []).length === 0 && (
              <p className="text-gray-400 col-span-3 text-center py-16">No stores available yet</p>
            )}
          </div>
        </div>
      </main>
      <SupportChat />
    </>
  )
}

function MerchantCard({ merchant, categoryLabel }: { merchant: Business; categoryLabel: string }) {
  return (
    <Link href={`/merchants/${merchant.id}`} className="group block bg-white rounded-2xl border border-gray-200 overflow-hidden hover:shadow-md transition-shadow">
      <div className="relative h-28 bg-gray-100">
        {merchant.logoUrl ? (
          <Image src={merchant.logoUrl} alt={merchant.name} fill className="object-cover" />
        ) : (
          <div className="flex items-center justify-center h-full">
            <Store className="h-10 w-10 text-gray-300" />
          </div>
        )}
        {!merchant.isVerified && (
          <span className="absolute top-2 left-2 text-[10px] bg-yellow-100 text-yellow-800 rounded-full px-2 py-0.5 font-medium">
            Pending verification
          </span>
        )}
      </div>
      <div className="p-3">
        <p className="font-semibold text-gray-900 text-sm group-hover:text-brand-700 transition-colors">{merchant.name}</p>
        <p className="text-xs text-gray-500">{categoryLabel}</p>
        <p className="text-xs text-gray-400 flex items-center gap-1 mt-1">
          <MapPin className="h-3 w-3" /> {merchant.barangay}
        </p>
      </div>
    </Link>
  )
}
