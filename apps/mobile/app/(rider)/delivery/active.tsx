import { useEffect, useRef } from 'react'
import {
  View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, Linking,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useLocalSearchParams, router } from 'expo-router'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Platform } from 'react-native'
import * as Location from 'expo-location'

const MapView = Platform.OS === 'web' ? null : require('react-native-maps').default
const PROVIDER_DEFAULT = Platform.OS === 'web' ? null : require('react-native-maps').PROVIDER_DEFAULT
import { io, Socket } from 'socket.io-client'
import { Phone, Navigation, Camera } from 'lucide-react-native'
import { api } from '@ebalangay/shared'
import { useAuthStore } from '@/stores/auth-store'

const BASE = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:3001'
const BUTUAN = { latitude: 8.9475, longitude: 125.5406 }

export default function ActiveDeliveryScreen() {
  const { orderId } = useLocalSearchParams<{ orderId: string }>()
  const { accessToken } = useAuthStore()
  const qc = useQueryClient()
  const mapRef = useRef<MapView>(null)
  const socketRef = useRef<Socket | null>(null)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const { data: order, isLoading } = useQuery({
    queryKey: ['active-delivery', orderId],
    queryFn: () => api.orders.get(orderId, accessToken!),
    enabled: !!accessToken && !!orderId,
    refetchInterval: 15_000,
  })

  // Start broadcasting location
  useEffect(() => {
    if (!accessToken) return
    const socket = io(BASE, { auth: { token: accessToken } })
    socketRef.current = socket

    intervalRef.current = setInterval(async () => {
      const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced })
      socket.emit('rider:location', {
        orderId,
        lat: loc.coords.latitude,
        lng: loc.coords.longitude,
      })
      mapRef.current?.animateToRegion({
        latitude: loc.coords.latitude,
        longitude: loc.coords.longitude,
        latitudeDelta: 0.01,
        longitudeDelta: 0.01,
      }, 600)
    }, 5_000)

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current)
      socket.disconnect()
    }
  }, [accessToken, orderId])

  const { mutate: markPickedUp, isPending: pickingUp } = useMutation({
    mutationFn: () => api.orders.updateStatus(orderId, 'OUT_FOR_DELIVERY', accessToken!),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['active-delivery', orderId] }),
  })

  if (isLoading || !order) {
    return (
      <SafeAreaView style={styles.container}>
        <ActivityIndicator color="#16a34a" style={{ flex: 1 }} />
      </SafeAreaView>
    )
  }

  const isPickedUp = order.status === 'OUT_FOR_DELIVERY'

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.topBar}>
        <Text style={styles.topTitle}>Active delivery</Text>
        <Text style={styles.orderId}>#{orderId.slice(-6).toUpperCase()}</Text>
      </View>

      {Platform.OS === 'web' ? (
        <View style={[styles.map, { alignItems: 'center', justifyContent: 'center', backgroundColor: '#f0fdf4' }]}>
          <Text style={{ color: '#6b7280' }}>Live map available on mobile</Text>
        </View>
      ) : (
        <MapView
          ref={mapRef}
          provider={PROVIDER_DEFAULT}
          style={styles.map}
          initialRegion={{ ...BUTUAN, latitudeDelta: 0.02, longitudeDelta: 0.02 }}
        />
      )}

      <View style={styles.bottomPanel}>
        <View style={styles.statusRow}>
          <View style={[styles.statusDot, { backgroundColor: isPickedUp ? '#16a34a' : '#f59e0b' }]} />
          <Text style={styles.statusText}>{isPickedUp ? 'Out for delivery' : 'Picking up order'}</Text>
        </View>

        <View style={styles.addressCard}>
          <Text style={styles.addrLabel}>{isPickedUp ? 'Delivering to' : 'Pickup from'}</Text>
          <Text style={styles.addrValue}>{isPickedUp ? order.deliveryAddress : order.pickupAddress}</Text>
        </View>

        {order.customerPhone && (
          <TouchableOpacity
            style={styles.callBtn}
            onPress={() => Linking.openURL(`tel:${order.customerPhone}`)}
          >
            <Phone size={16} color="#16a34a" />
            <Text style={styles.callBtnText}>Call customer</Text>
          </TouchableOpacity>
        )}

        {!isPickedUp && (
          <TouchableOpacity
            style={[styles.actionBtn, pickingUp && styles.btnDisabled]}
            onPress={() => markPickedUp()}
            disabled={pickingUp}
          >
            {pickingUp ? <ActivityIndicator color="#fff" /> : <Text style={styles.actionBtnText}>Mark as picked up</Text>}
          </TouchableOpacity>
        )}

        {isPickedUp && (
          <TouchableOpacity
            style={styles.actionBtn}
            onPress={() => router.push({ pathname: '/(rider)/delivery/proof', params: { orderId } })}
          >
            <Camera size={18} color="#fff" />
            <Text style={styles.actionBtnText}>Take proof of delivery</Text>
          </TouchableOpacity>
        )}
      </View>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  topBar: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16, borderBottomWidth: 1, borderBottomColor: '#f3f4f6' },
  topTitle: { fontSize: 17, fontWeight: '700', color: '#111827' },
  orderId: { fontSize: 13, color: '#6b7280', fontWeight: '500' },
  map: { flex: 1 },
  bottomPanel: { padding: 16, gap: 12, borderTopWidth: 1, borderTopColor: '#e5e7eb' },
  statusRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  statusDot: { width: 10, height: 10, borderRadius: 5 },
  statusText: { fontSize: 15, fontWeight: '600', color: '#111827' },
  addressCard: { backgroundColor: '#f9fafb', borderRadius: 10, padding: 12, borderWidth: 1, borderColor: '#e5e7eb' },
  addrLabel: { fontSize: 12, color: '#9ca3af', marginBottom: 4 },
  addrValue: { fontSize: 14, fontWeight: '500', color: '#111827' },
  callBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: '#f0fdf4', borderRadius: 10, paddingVertical: 12, borderWidth: 1, borderColor: '#bbf7d0' },
  callBtnText: { color: '#16a34a', fontWeight: '600', fontSize: 14 },
  actionBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: '#16a34a', borderRadius: 12, paddingVertical: 14 },
  btnDisabled: { opacity: 0.6 },
  actionBtnText: { color: '#fff', fontWeight: '700', fontSize: 15 },
})
