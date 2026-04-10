import { useEffect } from 'react'
import { Stack, router } from 'expo-router'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useAuthStore } from '@/stores/auth-store'

const queryClient = new QueryClient()

function RootNavigator() {
  const { user, isLoading, loadFromStore } = useAuthStore()

  useEffect(() => {
    loadFromStore()
  }, [])

  useEffect(() => {
    if (isLoading) return
    if (!user) {
      router.replace('/(auth)/login')
    } else if (user.role === 'RIDER') {
      router.replace('/(rider)')
    } else {
      router.replace('/(customer)')
    }
  }, [isLoading, user])

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="(auth)/login" />
      <Stack.Screen name="(auth)/register" />
      <Stack.Screen name="(customer)" />
      <Stack.Screen name="(rider)" />
    </Stack>
  )
}

export default function RootLayout() {
  return (
    <QueryClientProvider client={queryClient}>
      <RootNavigator />
    </QueryClientProvider>
  )
}
