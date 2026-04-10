import { NextResponse } from 'next/server'
import { api } from '@ebalangay/shared'

export async function POST(req: Request) {
  try {
    const body = await req.json() as { phone: string; password: string }
    const result = await api.auth.login(body)
    const res = NextResponse.json({ success: true, data: { user: result.user } })
    res.cookies.set('eb_access', result.accessToken, {
      httpOnly: true, secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax', maxAge: 86400, path: '/',
    })
    res.cookies.set('eb_refresh', result.refreshToken, {
      httpOnly: true, secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax', maxAge: 86400 * 30, path: '/',
    })
    return res
  } catch (err) {
    return NextResponse.json({ success: false, error: err instanceof Error ? err.message : 'Login failed' }, { status: 401 })
  }
}
