import { useEffect, useRef, useState } from 'react'
import {
  View, Text, Switch, StyleSheet, TouchableOpacity,
  ActivityIndicator, ScrollView, Alert,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { router } from 'expo-router'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { io, Socket } from 'socket.io-client'
import * as Location from 'expo-location'
import { api } from '@ebalangay/shared'
import { useAuthStore } from '@/stores/auth-store'
import { DollarSign, Package, LogOut } from 'lucide-react-native'
import { startBackgroundLocation, stopBackgroundLocation } from '@/tasks/background-location'

const BASE = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:3001'

function formatPeso(amount: number) {
  return `₱${amount.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

export default function RiderDashboardScreen() {
  const { accessToken, user, clearAuth } = useAuthStore()
  const qc = useQueryClient()
  const socketRef = useRef<Socket | null>(null)
  const locationIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const [isOnline, setIsOnline] = useState(false)

  const { data: stats } = useQuery({
    queryKey: ['rider-stats'],
    queryFn: () => api.analytics.getRiderStats(accessToken!),
    enabled: !!accessToken,
    refetchInterval: 60_000,
  })

  const { mutate: toggleOnline, isPending } = useMutation({
    mutationFn: (online: boolean) => api.riders.setAvailability(online, 'Butuan City', accessToken!),
    onSuccess: (_, online) => setIsOnline(online),
    onError: () => Alert.alert('Error', 'Could not update availability.'),
  })

  // Request location & start broadcasting when online
  useEffect(() => {
    if (!isOnline || !accessToken) {
      if (locationIntervalRef.current) clearInterval(locationIntervalRef.current)
      socketRef.current?.disconnect()
      stopBackgroundLocation()
      return
    }

    let socket: Socket
    ;(async () => {
      const { status } = await Location.requestForegroundPermissionsAsync()
      if (status !== 'granted') {
        Alert.alert('Location required', 'Please enable location to go online.')
        setIsOnline(false)
        return
      }

      // Start background location tracking
      await startBackgroundLocation()

      socket = io(BASE, { auth: { token: accessToken } })
      socketRef.current = socket

      // Listen for incoming job offers
      socket.on('dispatch:offer', (data: { orderId: string; pickupAddress: string; deliveryAddress: string; fee: number }) => {
        router.push({ pathname: '/(rider)/job-offer', params: data })
      })

      // Foreground location broadcast every 5s
      locationIntervalRef.current = setInterval(async () => {
        const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced })
        socket.emit('rider:location', {
          lat: loc.coords.latitude,
          lng: loc.coords.longitude,
        })
      }, 5_000)
    })()

    return () => {
      if (locationIntervalRef.current) clearInterval(locationIntervalRef.current)
      socket?.disconnect()
    }
  }, [isOnline, accessToken])

  const handleLogout = async () => {
    await clearAuth()
    router.replace('/(auth)/login')
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <View>
          <Text style={styles.greeting}>Hi, {user?.name?.split(' ')[0]}</Text>
          <Text style={styles.subtitle}>Rider dashboard</Text>
        </View>
        <TouchableOpacity onPress={handleLogout} style={styles.logoutBtn}>
          <LogOut size={20} color="#6b7280" />
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        {/* Online toggle */}
        <View style={[styles.onlineCard, { backgroundColor: isOnline ? '#f0fdf4' : '#f9fafb' }]}>
          <View>
            <Text style={styles.onlineTitle}>{isOnline ? 'You are online' : 'You are offline'}</Text>
            <Text style={styles.onlineSubtitle}>{isOnline ? 'Waiting for delivery orders…' : 'Toggle to start receiving orders'}</Text>
          </View>
          {isPending
            ? <ActivityIndicator color="#16a34a" />
            : (
              <Switch
                value={isOnline}
                onValueChange={toggleOnline}
                trackColor={{ false: '#d1d5db', true: '#bbf7d0' }}
                thumbColor={isOnline ? '#16a34a' : '#9ca3af'}
              />
            )
          }
        </View>

        {/* Stats */}
        {stats && (
          <View style={styles.statsRow}>
            <View style={styles.statCard}>
              <Package size={20} color="#16a34a" />
              <Text style={styles.statValue}>{stats.todayDeliveries}</Text>
              <Text style={styles.statLabel}>Today's deliveries</Text>
            </View>
            <View style={styles.statCard}>
              <DollarSign size={20} color="#16a34a" />
              <Text style={styles.statValue}>{formatPeso(stats.todayEarnings)}</Text>
              <Text style={styles.statLabel}>Today's earnings</Text>
            </View>
          </View>
        )}

        {/* Earnings shortcut */}
        <TouchableOpacity style={styles.earningsBtn} onPress={() => router.push('/(rider)/earnings')}>
          <Text style={styles.earningsBtnText}>View full earnings history</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', padding: 16, borderBottomWidth: 1, borderBottomColor: '#f3f4f6' },
  greeting: { fontSize: 22, fontWeight: '700', color: '#111827' },
  subtitle: { fontSize: 13, color: '#6b7280', marginTop: 2 },
  logoutBtn: { padding: 8 },
  content: { padding: 16, gap: 16 },
  onlineCard: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 16, borderRadius: 14, borderWidth: 1, borderColor: '#e5e7eb' },
  onlineTitle: { fontSize: 16, fontWeight: '600', color: '#111827' },
  onlineSubtitle: { fontSize: 13, color: '#6b7280', marginTop: 2, maxWidth: 220 },
  statsRow: { flexDirection: 'row', gap: 12 },
  statCard: { flex: 1, backgroundColor: '#f9fafb', borderRadius: 12, padding: 16, alignItems: 'center', borderWidth: 1, borderColor: '#e5e7eb', gap: 6 },
  statValue: { fontSize: 20, fontWeight: '700', color: '#111827' },
  statLabel: { fontSize: 12, color: '#6b7280', textAlign: 'center' },
  earningsBtn: { backgroundColor: '#f0fdf4', borderRadius: 12, paddingVertical: 14, alignItems: 'center', borderWidth: 1, borderColor: '#bbf7d0' },
  earningsBtnText: { color: '#16a34a', fontWeight: '600', fontSize: 15 },
})
