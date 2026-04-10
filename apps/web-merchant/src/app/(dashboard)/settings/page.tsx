'use client'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useAuthStore } from '@/stores/auth-store'
import { api } from '@ebalangay/shared'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { useState } from 'react'

const schema = z.object({
  name: z.string().min(2),
  barangay: z.string().min(1),
  city: z.string().min(1),
  payoutGcash: z.string().regex(/^(\+63|0)9\d{9}$/, 'Invalid GCash number').optional().or(z.literal('')),
})
type FormData = z.infer<typeof schema>

export default function SettingsPage() {
  const { user, accessToken, setAuth, refreshToken } = useAuthStore()
  const qc = useQueryClient()
  const [saved, setSaved] = useState(false)

  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: user?.business?.name ?? '',
      barangay: user?.business?.barangay ?? '',
      city: user?.business?.city ?? 'Butuan City',
      payoutGcash: user?.business?.payoutGcash ?? '',
    },
  })

  const update = useMutation({
    mutationFn: (data: FormData) =>
      api.businesses.update(user!.business!.id, data, accessToken!),
    onSuccess: async () => {
      setSaved(true)
      setTimeout(() => setSaved(false), 3000)
      qc.invalidateQueries({ queryKey: ['merchant-dashboard'] })
      // Refresh user in store
      if (accessToken) {
        const fresh = await api.auth.me(accessToken)
        setAuth(fresh, accessToken, refreshToken!)
      }
    },
  })

  return (
    <div className="p-6 space-y-6 max-w-xl">
      <h1 className="text-xl font-semibold text-gray-900">Settings</h1>

      <Card>
        <CardHeader><CardTitle>Store profile</CardTitle></CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit((d) => update.mutate(d))} className="space-y-4">
            <Input {...register('name')} label="Store name" error={errors.name?.message} />
            <Input {...register('barangay')} label="Barangay" error={errors.barangay?.message} />
            <Input {...register('city')} label="City" error={errors.city?.message} />
            <Input
              {...register('payoutGcash')}
              label="GCash number for payouts"
              placeholder="09XXXXXXXXX"
              type="tel"
              error={errors.payoutGcash?.message}
            />
            {update.error && (
              <p className="text-sm text-red-600">{update.error.message}</p>
            )}
            {saved && <p className="text-sm text-green-600">Settings saved!</p>}
            <Button type="submit" loading={isSubmitting || update.isPending}>Save changes</Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Account</CardTitle></CardHeader>
        <CardContent className="space-y-2 text-sm text-gray-600">
          <p>Phone: <span className="font-medium text-gray-900">{user?.phone}</span></p>
          <p>Name: <span className="font-medium text-gray-900">{user?.name}</span></p>
          <p>Store type: <span className="font-medium text-gray-900">{user?.business?.type ?? '—'}</span></p>
          <p>Verified: <span className="font-medium text-gray-900">{user?.business?.isVerified ? 'Yes' : 'Pending'}</span></p>
        </CardContent>
      </Card>
    </div>
  )
}
