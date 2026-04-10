'use client'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import Link from 'next/link'
import { Building2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { api } from '@ebalangay/shared'

const schema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters'),
  phone: z.string().regex(/^(\+63|0)9\d{9}$/, 'Invalid Philippine mobile number'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  otp: z.string().length(6, 'OTP must be 6 digits').optional(),
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
        const res = await api.auth.register({
          name: data.name,
          phone: data.phone,
          password: data.password,
          role: 'MERCHANT',
        })
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
        <div className="flex flex-col items-center mb-8">
          <div className="flex items-center gap-2 mb-2">
            <Building2 className="h-8 w-8 text-brand-600" />
            <span className="text-2xl font-bold text-gray-900">eBalangay</span>
          </div>
          <p className="text-gray-500 text-sm">Create your merchant account</p>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6">
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            {step === 'form' ? (
              <>
                <Input {...register('name')} label="Store / owner name" placeholder="Juan dela Cruz" error={errors.name?.message} />
                <Input {...register('phone')} label="Phone number" placeholder="09XXXXXXXXX" type="tel" error={errors.phone?.message} />
                <Input {...register('password')} label="Password" type="password" placeholder="Min. 8 characters" error={errors.password?.message} />
                {error && <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</p>}
                <Button type="submit" className="w-full" loading={isSubmitting}>Continue</Button>
              </>
            ) : (
              <>
                <p className="text-sm text-gray-600">Enter the 6-digit OTP sent to your phone.</p>
                <Input {...register('otp')} label="OTP Code" placeholder="123456" maxLength={6} error={errors.otp?.message} />
                {error && <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</p>}
                <Button type="submit" className="w-full" loading={isSubmitting}>Verify & Create Account</Button>
              </>
            )}
          </form>
          <p className="text-center text-sm text-gray-500 mt-4">
            Already have an account?{' '}
            <Link href="/login" className="text-brand-600 font-medium hover:underline">Sign in</Link>
          </p>
        </div>
      </div>
    </div>
  )
}
