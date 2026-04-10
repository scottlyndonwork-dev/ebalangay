import { Platform } from 'react-native'

export const BACKGROUND_LOCATION_TASK = 'BACKGROUND_LOCATION'

export async function startBackgroundLocation(): Promise<boolean> {
  if (Platform.OS === 'web') return false

  const Location = await import('expo-location')
  const TaskManager = await import('expo-task-manager')

  const { status } = await Location.requestBackgroundPermissionsAsync()
  if (status !== 'granted') return false

  const isRegistered = await TaskManager.isTaskRegisteredAsync(BACKGROUND_LOCATION_TASK)
  if (!isRegistered) {
    await Location.startLocationUpdatesAsync(BACKGROUND_LOCATION_TASK, {
      accuracy: Location.Accuracy.Balanced,
      distanceInterval: 20,
      timeInterval: 5_000,
      showsBackgroundLocationIndicator: true,
      foregroundService: {
        notificationTitle: 'eBalangay',
        notificationBody: 'Sharing your location for active delivery',
        notificationColor: '#16a34a',
      },
    })
  }
  return true
}

export async function stopBackgroundLocation(): Promise<void> {
  if (Platform.OS === 'web') return

  const Location = await import('expo-location')
  const TaskManager = await import('expo-task-manager')

  const isRegistered = await TaskManager.isTaskRegisteredAsync(BACKGROUND_LOCATION_TASK)
  if (isRegistered) {
    await Location.stopLocationUpdatesAsync(BACKGROUND_LOCATION_TASK)
  }
}

// The actual task definition must only run on native — wrap in Platform check
if (Platform.OS !== 'web') {
  void import('expo-task-manager').then(TaskManager => {
    void import('expo-location').then(() => {
      void import('expo-secure-store').then(SecureStore => {
        void import('socket.io-client').then(({ io }) => {
          const BASE = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:3001'
          let socket: ReturnType<typeof io> | null = null

          TaskManager.defineTask(BACKGROUND_LOCATION_TASK, async ({ data, error }: any) => {
            if (error) { console.error('[BG Location]', error.message); return }
            const { locations } = data as { locations: Array<{ coords: { latitude: number; longitude: number } }> }
            if (!locations?.length) return
            const { latitude, longitude } = locations[0].coords
            try {
              const token = await SecureStore.getItemAsync('eb_access')
              if (!token) return
              if (!socket || !socket.connected) socket = io(BASE, { auth: { token } })
              socket.emit('rider:location', { lat: latitude, lng: longitude })
            } catch (e) {
              console.error('[BG Location] emit failed', e)
            }
          })
        })
      })
    })
  })
}
