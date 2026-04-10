import { useEffect, useState } from 'react'
import {
  View, Text, StyleSheet, TouchableOpacity, ActivityIndicator,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useLocalSearchParams, router } from 'expo-router'
import { useMutation } from '@tanstack/react-query'
import { MapPin, DollarSign, Clock } from 'lucide-react-native'
import { api } from '@ebalangay/shared'
import { useAuthStore } from '@/stores/auth-store'

const OFFER_TIMEOUT = 60

function formatPeso(amount: number) {
  return `₱${amount.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

export default function JobOfferScreen() {
  const { orderId, pickupAddress, deliveryAddress, fee } = useLocalSearchParams<{
    orderId: string
    pickupAddress: string
    deliveryAddress: string
    fee: string
  }>()
  const { accessToken } = useAuthStore()
  const [countdown, setCountdown] = useState(OFFER_TIMEOUT)

  // Countdown timer
  useEffect(() => {
    const interval = setInterval(() => {
      setCountdown(prev => {
        if (prev <= 1) {
          clearInterval(interval)
          router.back()
          return 0
        }
        return prev - 1
      })
    }, 1_000)
    return () => clearInterval(interval)
  }, [])

  const { mutate: accept, isPending: accepting } = useMutation({
    mutationFn: () => api.orders.acceptDelivery(accessToken!, orderId),
    onSuccess: () => router.replace({ pathname: '/(rider)/delivery/active', params: { orderId } }),
  })

  const { mutate: decline, isPending: declining } = useMutation({
    mutationFn: () => api.orders.declineDelivery(accessToken!, orderId),
    onSuccess: () => router.back(),
  })

  const progress = countdown / OFFER_TIMEOUT

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.inner}>
        <Text style={styles.heading}>New delivery offer</Text>

        {/* Countdown ring (simple text-based) */}
        <View style={styles.countdownCircle}>
          <Clock size={24} color="#16a34a" />
          <Text style={styles.countdownText}>{countdown}s</Text>
        </View>

        {/* Progress bar */}
        <View style={styles.progressTrack}>
          <View style={[styles.progressFill, { width: `${progress * 100}%` }]} />
        </View>

        {/* Order details */}
        <View style={styles.detailsCard}>
          <View style={styles.detailRow}>
            <DollarSign size={18} color="#16a34a" />
            <View>
              <Text style={styles.detailLabel}>Delivery fee</Text>
              <Text style={styles.detailValue}>{formatPeso(Number(fee))}</Text>
            </View>
          </View>

          <View style={styles.divider} />

          <View style={styles.detailRow}>
            <MapPin size={18} color="#f59e0b" />
            <View style={styles.detailTextBlock}>
              <Text style={styles.detailLabel}>Pickup from</Text>
              <Text style={styles.detailValue}>{pickupAddress}</Text>
            </View>
          </View>

          <View style={styles.detailRow}>
            <MapPin size={18} color="#ef4444" />
            <View style={styles.detailTextBlock}>
              <Text style={styles.detailLabel}>Deliver to</Text>
              <Text style={styles.detailValue}>{deliveryAddress}</Text>
            </View>
          </View>
        </View>

        {/* Actions */}
        <TouchableOpacity
          style={[styles.acceptBtn, accepting && styles.btnDisabled]}
          onPress={() => accept()}
          disabled={accepting || declining}
        >
          {accepting ? <ActivityIndicator color="#fff" /> : <Text style={styles.acceptBtnText}>Accept</Text>}
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.declineBtn, declining && styles.btnDisabled]}
          onPress={() => decline()}
          disabled={accepting || declining}
        >
          {declining ? <ActivityIndicator color="#6b7280" /> : <Text style={styles.declineBtnText}>Decline</Text>}
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  inner: { flex: 1, padding: 24, alignItems: 'center', gap: 16 },
  heading: { fontSize: 22, fontWeight: '700', color: '#111827', marginBottom: 4 },
  countdownCircle: { alignItems: 'center', justifyContent: 'center', width: 96, height: 96, borderRadius: 48, borderWidth: 3, borderColor: '#bbf7d0', gap: 4 },
  countdownText: { fontSize: 22, fontWeight: '700', color: '#15803d' },
  progressTrack: { width: '100%', height: 6, backgroundColor: '#e5e7eb', borderRadius: 3, overflow: 'hidden' },
  progressFill: { height: '100%', backgroundColor: '#16a34a', borderRadius: 3 },
  detailsCard: { width: '100%', backgroundColor: '#f9fafb', borderRadius: 14, padding: 16, borderWidth: 1, borderColor: '#e5e7eb', gap: 12 },
  detailRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  detailTextBlock: { flex: 1 },
  detailLabel: { fontSize: 12, color: '#9ca3af', marginBottom: 2 },
  detailValue: { fontSize: 15, fontWeight: '600', color: '#111827' },
  divider: { height: 1, backgroundColor: '#e5e7eb' },
  acceptBtn: { width: '100%', backgroundColor: '#16a34a', borderRadius: 12, paddingVertical: 14, alignItems: 'center' },
  btnDisabled: { opacity: 0.6 },
  acceptBtnText: { color: '#fff', fontWeight: '700', fontSize: 16 },
  declineBtn: { width: '100%', backgroundColor: '#f3f4f6', borderRadius: 12, paddingVertical: 14, alignItems: 'center' },
  declineBtnText: { color: '#6b7280', fontWeight: '600', fontSize: 16 },
})
