import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { api } from '@ebalangay/shared'

export async function POST() {
  const cookieStore = await cookies()
  const token = cookieStore.get('eb_access')?.value
  const refreshToken = cookieStore.get('eb_refresh')?.value

  if (token && refreshToken) {
    await api.auth.logout(token, refreshToken).catch(() => {})
  }

  const res = NextResponse.json({ success: true })
  res.cookies.delete('eb_access')
  res.cookies.delete('eb_refresh')
  return res
}
