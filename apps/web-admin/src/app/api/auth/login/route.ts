import { NextResponse } from 'next/server'
import { api } from '@ebalangay/shared'

export async function POST(req: Request) {
  try {
    const body = await req.json() as { phone: string; password: string }
    const result = await api.auth.login(body)
    if (result.user.role !== 'ADMIN') {
      return NextResponse.json({ success: false, error: 'Admin access only' }, { status: 403 })
    }
    const res = NextResponse.json({ success: true, data: { user: result.user } })
    res.cookies.set('eb_admin_access', result.accessToken, {
      httpOnly: true, secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax', maxAge: 86400, path: '/',
    })
    return res
  } catch (err) {
    return NextResponse.json({ success: false, error: err instanceof Error ? err.message : 'Login failed' }, { status: 401 })
  }
}
