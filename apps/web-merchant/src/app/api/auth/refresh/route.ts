import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { api } from '@ebalangay/shared'

export async function POST() {
  const cookieStore = await cookies()
  const refreshToken = cookieStore.get('eb_refresh')?.value

  if (!refreshToken) {
    return NextResponse.json({ success: false, error: 'No refresh token' }, { status: 401 })
  }

  try {
    const tokens = await api.auth.refresh(refreshToken)

    const res = NextResponse.json({ success: true })
    res.cookies.set('eb_access', tokens.accessToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24,
      path: '/',
    })
    res.cookies.set('eb_refresh', tokens.refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 30,
      path: '/',
    })
    return res
  } catch {
    const res = NextResponse.json({ success: false, error: 'Refresh failed' }, { status: 401 })
    res.cookies.delete('eb_access')
    res.cookies.delete('eb_refresh')
    return res
  }
}
