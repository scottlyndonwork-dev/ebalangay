'use client'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import Link from 'next/link'
import { api } from '@ebalangay/shared'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

const schema = z.object({
  name: z.string().min(2),
  phone: z.string().regex(/^(\+63|0)9\d{9}$/, 'Invalid Philippine mobile number'),
  password: z.string().min(8),
  otp: z.string().length(6).optional(),
})
type FormData = z.infer<typeof schema>

export default function RegisterPage() {
  const router = useRouter()
  const [step, setStep] = useState<'form' | 'otp'>('form')
  const [userId, setUserId] = useState('')
  const [error, setError] = useState('')

  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<FormData>({
    resolver: zodResolver(schema),
  })

  async function onSubmit(data: FormData) {
    setError('')
    try {
      if (step === 'form') {
        const res = await api.auth.register({ name: data.name, phone: data.phone, password: data.password, role: 'CUSTOMER' })
        setUserId(res.userId)
        setStep('otp')
      } else if (data.otp) {
        await api.auth.verifyOtp({ userId, otp: data.otp })
        router.push('/login?registered=1')
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Registration failed')
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <div className="w-full max-w-sm">
        <h1 className="text-2xl font-bold text-center text-gray-900 mb-2">Create account</h1>
        <p className="text-center text-gray-500 text-sm mb-6">Join eBalangay</p>
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6 space-y-4">
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            {step === 'form' ? (
              <>
                <Input {...register('name')} label="Full name" placeholder="Juan dela Cruz" error={errors.name?.message} />
                <Input {...register('phone')} label="Phone number" placeholder="09XXXXXXXXX" type="tel" error={errors.phone?.message} />
                <Input {...register('password')} label="Password" type="password" placeholder="Min. 8 characters" error={errors.password?.message} />
              </>
            ) : (
              <Input {...register('otp')} label="OTP Code" placeholder="123456" maxLength={6} error={errors.otp?.message} />
            )}
            {error && <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</p>}
            <Button type="submit" className="w-full" loading={isSubmitting}>
              {step === 'form' ? 'Continue' : 'Verify & Create Account'}
            </Button>
          </form>
          <p className="text-center text-sm text-gray-500">
            Already have an account?{' '}
            <Link href="/login" className="text-brand-600 font-medium hover:underline">Sign in</Link>
          </p>
        </div>
      </div>
    </div>
  )
}
