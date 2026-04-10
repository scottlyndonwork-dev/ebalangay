import { useEffect, useRef, useState } from 'react'
import {
  View, Text, StyleSheet, ActivityIndicator, TouchableOpacity,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useLocalSearchParams, router } from 'expo-router'
import { useQuery } from '@tanstack/react-query'
import { Platform } from 'react-native'
import { io, Socket } from 'socket.io-client'

const MapView = Platform.OS === 'web' ? null : require('react-native-maps').default
const Marker = Platform.OS === 'web' ? null : require('react-native-maps').Marker
const PROVIDER_DEFAULT = Platform.OS === 'web' ? null : require('react-native-maps').PROVIDER_DEFAULT
import { api } from '@ebalangay/shared'
import { useAuthStore } from '@/stores/auth-store'
import { ArrowLeft, Navigation } from 'lucide-react-native'

const BASE = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:3001'

const BUTUAN = { latitude: 8.9475, longitude: 125.5406 }

const STATUS_STEPS = [
  'PLACED', 'CONFIRMED', 'PREPARING', 'READY_FOR_PICKUP', 'OUT_FOR_DELIVERY', 'DELIVERED',
]

export default function TrackOrderScreen() {
  const { id } = useLocalSearchParams<{ id: string }>()
  const { accessToken } = useAuthStore()
  const mapRef = useRef<MapView>(null)
  const socketRef = useRef<Socket | null>(null)
  const [riderLocation, setRiderLocation] = useState<{ lat: number; lng: number } | null>(null)

  const { data: order, isLoading } = useQuery({
    queryKey: ['order', id],
    queryFn: () => api.orders.get(id, accessToken!),
    enabled: !!accessToken && !!id,
    refetchInterval: 15_000,
  })

  // Socket.io for live rider location
  useEffect(() => {
    if (!accessToken || !id) return
    const socket = io(BASE, { auth: { token: accessToken } })
    socketRef.current = socket

    socket.on('rider:location', (data: { orderId: string; lat: number; lng: number }) => {
      if (data.orderId === id) {
        setRiderLocation({ lat: data.lat, lng: data.lng })
        mapRef.current?.animateToRegion({
          latitude: data.lat,
          longitude: data.lng,
          latitudeDelta: 0.01,
          longitudeDelta: 0.01,
        }, 800)
      }
    })

    return () => { socket.disconnect() }
  }, [accessToken, id])

  if (isLoading || !order) {
    return (
      <SafeAreaView style={styles.container}>
        <ActivityIndicator color="#16a34a" style={{ flex: 1 }} />
      </SafeAreaView>
    )
  }

  const stepIndex = STATUS_STEPS.indexOf(order.status)

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.topBar}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <ArrowLeft size={20} color="#111827" />
        </TouchableOpacity>
        <Text style={styles.topTitle}>Track order #{id.slice(-6).toUpperCase()}</Text>
      </View>

      {/* Map */}
      {Platform.OS === 'web' ? (
        <View style={[styles.map, { alignItems: 'center', justifyContent: 'center', backgroundColor: '#f0fdf4' }]}>
          <Navigation size={32} color="#16a34a" />
          <Text style={{ color: '#6b7280', marginTop: 8 }}>Live map available on mobile</Text>
        </View>
      ) : (
        <MapView
          ref={mapRef}
          provider={PROVIDER_DEFAULT}
          style={styles.map}
          initialRegion={{
            latitude: riderLocation?.lat ?? BUTUAN.latitude,
            longitude: riderLocation?.lng ?? BUTUAN.longitude,
            latitudeDelta: 0.02,
            longitudeDelta: 0.02,
          }}
        >
          {riderLocation && MapView && (
            <Marker
              coordinate={{ latitude: riderLocation.lat, longitude: riderLocation.lng }}
              title={order.riderName ?? 'Rider'}
            >
              <View style={styles.riderMarker}>
                <Navigation size={18} color="#fff" />
              </View>
            </Marker>
          )}
        </MapView>
      )}

      {/* Status strip */}
      <View style={styles.statusPanel}>
        <Text style={styles.statusTitle}>{order.status.replace(/_/g, ' ')}</Text>

        <View style={styles.stepsRow}>
          {STATUS_STEPS.slice(0, -1).map((step, i) => (
            <View key={step} style={styles.stepItem}>
              <View style={[
                styles.stepDot,
                i < stepIndex && styles.stepDone,
                i === stepIndex && styles.stepActive,
              ]} />
              {i < STATUS_STEPS.length - 2 && (
                <View style={[styles.stepLine, i < stepIndex && styles.stepLineDone]} />
              )}
            </View>
          ))}
        </View>

        {order.riderName && (
          <View style={styles.riderInfo}>
            <Text style={styles.riderLabel}>Your rider</Text>
            <Text style={styles.riderName}>{order.riderName}</Text>
          </View>
        )}
      </View>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  topBar: { flexDirection: 'row', alignItems: 'center', padding: 16, gap: 12, borderBottomWidth: 1, borderBottomColor: '#f3f4f6' },
  backBtn: { padding: 4 },
  topTitle: { fontSize: 16, fontWeight: '600', color: '#111827' },
  map: { flex: 1 },
  riderMarker: { width: 36, height: 36, borderRadius: 18, backgroundColor: '#16a34a', alignItems: 'center', justifyContent: 'center' },
  statusPanel: { padding: 16, borderTopWidth: 1, borderTopColor: '#e5e7eb', gap: 12 },
  statusTitle: { fontSize: 17, fontWeight: '700', color: '#111827', textTransform: 'capitalize' },
  stepsRow: { flexDirection: 'row', alignItems: 'center' },
  stepItem: { flexDirection: 'row', alignItems: 'center', flex: 1 },
  stepDot: { width: 12, height: 12, borderRadius: 6, backgroundColor: '#e5e7eb' },
  stepDone: { backgroundColor: '#16a34a' },
  stepActive: { backgroundColor: '#16a34a', width: 14, height: 14, borderRadius: 7, borderWidth: 2, borderColor: '#bbf7d0' },
  stepLine: { flex: 1, height: 2, backgroundColor: '#e5e7eb' },
  stepLineDone: { backgroundColor: '#16a34a' },
  riderInfo: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  riderLabel: { fontSize: 13, color: '#6b7280' },
  riderName: { fontSize: 14, fontWeight: '600', color: '#111827' },
})
