import { NextResponse } from 'next/server'
import { api } from '@ebalangay/shared'

export async function POST(req: Request) {
  try {
    const body = await req.json() as { phone: string; password: string }
    const result = await api.auth.login(body)

    const res = NextResponse.json({ success: true, data: { user: result.user } })

    res.cookies.set('eb_access', result.accessToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24, // 24h
      path: '/',
    })

    res.cookies.set('eb_refresh', result.refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 30, // 30d
      path: '/',
    })

    return res
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Login failed'
    return NextResponse.json({ success: false, error: message }, { status: 401 })
  }
}
