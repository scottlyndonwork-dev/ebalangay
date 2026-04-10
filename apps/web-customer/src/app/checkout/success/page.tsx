'use client'
import Link from 'next/link'
import { useSearchParams, Suspense } from 'react'
import { CheckCircle } from 'lucide-react'
import { Navbar } from '@/components/layout/navbar'
import { Button } from '@/components/ui/button'

function SuccessContent() {
  const searchParams = useSearchParams()
  const orderId = searchParams.get('orderId')

  return (
    <div className="max-w-sm mx-auto px-4 py-16 text-center space-y-4">
      <CheckCircle className="h-16 w-16 text-brand-600 mx-auto" />
      <h1 className="text-2xl font-bold text-gray-900">Order placed!</h1>
      <p className="text-gray-500 text-sm">
        Your order has been received. We'll notify you once the merchant confirms it.
      </p>
      {orderId && (
        <p className="text-xs text-gray-400 font-mono">#{orderId.slice(-8).toUpperCase()}</p>
      )}
      <div className="flex flex-col gap-3 pt-4">
        {orderId && (
          <Link href={`/orders/${orderId}`}>
            <Button className="w-full">Track your order</Button>
          </Link>
        )}
        <Link href="/">
          <Button variant="secondary" className="w-full">Continue shopping</Button>
        </Link>
      </div>
    </div>
  )
}

export default function CheckoutSuccessPage() {
  return (
    <>
      <Navbar />
      <Suspense>
        <SuccessContent />
      </Suspense>
    </>
  )
}
