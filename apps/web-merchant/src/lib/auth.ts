import { cookies } from 'next/headers'
import { api } from '@ebalangay/shared'

export const ACCESS_TOKEN_COOKIE = 'eb_access'
export const REFRESH_TOKEN_COOKIE = 'eb_refresh'

export async function getServerToken(): Promise<string | undefined> {
  const cookieStore = await cookies()
  return cookieStore.get(ACCESS_TOKEN_COOKIE)?.value
}

export async function getServerUser() {
  const token = await getServerToken()
  if (!token) return null
  try {
    return await api.auth.me(token)
  } catch {
    return null
  }
}
