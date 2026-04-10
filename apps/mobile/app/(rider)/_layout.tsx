import { Stack } from 'expo-router'

export default function RiderLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="job-offer" options={{ presentation: 'modal' }} />
      <Stack.Screen name="delivery/active" />
      <Stack.Screen name="delivery/proof" />
      <Stack.Screen name="earnings" />
    </Stack>
  )
}
