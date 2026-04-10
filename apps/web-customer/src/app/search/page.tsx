'use client'
import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import Link from 'next/link'
import Image from 'next/image'
import { Search, Store, MapPin } from 'lucide-react'
import { Navbar } from '@/components/layout/navbar'
import { api, type Business } from '@ebalangay/shared'

export default function SearchPage() {
  const [query, setQuery] = useState('')

  const { data, isLoading } = useQuery({
    queryKey: ['search-merchants', query],
    queryFn: () => api.businesses.list({ search: query }),
    enabled: query.length >= 2,
  })

  return (
    <>
      <Navbar />
      <main className="max-w-xl mx-auto px-4 py-6 space-y-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <input
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Search stores…"
            autoFocus
            className="w-full h-11 pl-10 pr-4 rounded-xl border border-gray-300 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
          />
        </div>

        {query.length >= 2 && isLoading && (
          <div className="space-y-3">{[...Array(3)].map((_, i) => <div key={i} className="h-16 rounded-xl bg-gray-200 animate-pulse" />)}</div>
        )}

        {(data ?? []).map((m: Business) => (
          <Link key={m.id} href={`/merchants/${m.id}`} className="flex items-center gap-3 bg-white rounded-xl border border-gray-200 p-3 hover:shadow-sm transition-shadow">
            <div className="h-12 w-12 rounded-lg bg-gray-100 overflow-hidden flex-shrink-0">
              {m.logoUrl ? (
                <Image src={m.logoUrl} alt={m.name} width={48} height={48} className="object-cover w-full h-full" />
              ) : (
                <div className="flex items-center justify-center h-full"><Store className="h-5 w-5 text-gray-300" /></div>
              )}
            </div>
            <div>
              <p className="font-medium text-gray-900 text-sm">{m.name}</p>
              <p className="text-xs text-gray-500 flex items-center gap-1"><MapPin className="h-3 w-3" />{m.barangay}</p>
            </div>
          </Link>
        ))}

        {query.length >= 2 && !isLoading && (data ?? []).length === 0 && (
          <p className="text-center text-gray-400 py-8">No stores found for &ldquo;{query}&rdquo;</p>
        )}
        {query.length < 2 && (
          <p className="text-center text-gray-400 text-sm pt-8">Type at least 2 characters to search</p>
        )}
      </main>
    </>
  )
}
