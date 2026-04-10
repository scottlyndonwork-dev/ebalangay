import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'

export async function POST() {
  const res = NextResponse.json({ success: true })
  const cookieStore = await cookies()
  cookieStore.getAll().forEach(c => res.cookies.delete(c.name))
  res.cookies.delete('eb_admin_access')
  return res
}
