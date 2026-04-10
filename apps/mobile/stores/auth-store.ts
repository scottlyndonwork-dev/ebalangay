import { create } from 'zustand'
import { Platform } from 'react-native'
import type { User } from '@ebalangay/shared'

const ACCESS_KEY = 'eb_access'
const REFRESH_KEY = 'eb_refresh'

// Web falls back to localStorage; native uses SecureStore
const storage = {
  async get(key: string): Promise<string | null> {
    if (Platform.OS === 'web') {
      return localStorage.getItem(key)
    }
    const SecureStore = await import('expo-secure-store')
    return SecureStore.getItemAsync(key)
  },
  async set(key: string, value: string): Promise<void> {
    if (Platform.OS === 'web') {
      localStorage.setItem(key, value)
      return
    }
    const SecureStore = await import('expo-secure-store')
    return SecureStore.setItemAsync(key, value)
  },
  async del(key: string): Promise<void> {
    if (Platform.OS === 'web') {
      localStorage.removeItem(key)
      return
    }
    const SecureStore = await import('expo-secure-store')
    return SecureStore.deleteItemAsync(key)
  },
}

interface AuthState {
  user: User | null
  accessToken: string | null
  refreshToken: string | null
  isLoading: boolean
  setAuth: (user: User, accessToken: string, refreshToken: string) => Promise<void>
  clearAuth: () => Promise<void>
  loadFromStore: () => Promise<void>
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  accessToken: null,
  refreshToken: null,
  isLoading: true,

  setAuth: async (user, accessToken, refreshToken) => {
    await storage.set(ACCESS_KEY, accessToken)
    await storage.set(REFRESH_KEY, refreshToken)
    set({ user, accessToken, refreshToken })
  },

  clearAuth: async () => {
    await storage.del(ACCESS_KEY)
    await storage.del(REFRESH_KEY)
    set({ user: null, accessToken: null, refreshToken: null })
  },

  loadFromStore: async () => {
    try {
      const accessToken = await storage.get(ACCESS_KEY)
      const refreshToken = await storage.get(REFRESH_KEY)
      if (accessToken) {
        set({ accessToken, refreshToken })
      }
    } finally {
      set({ isLoading: false })
    }
  },
}))
