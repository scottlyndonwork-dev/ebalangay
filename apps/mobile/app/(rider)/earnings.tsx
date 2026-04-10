import {
  View, Text, FlatList, StyleSheet, TouchableOpacity, ActivityIndicator,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { router } from 'expo-router'
import { useQuery } from '@tanstack/react-query'
import { ArrowLeft, TrendingUp } from 'lucide-react-native'
import { api } from '@ebalangay/shared'
import { useAuthStore } from '@/stores/auth-store'

function formatPeso(amount: number) {
  return `₱${amount.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' })
}

export default function EarningsScreen() {
  const { accessToken } = useAuthStore()

  const { data, isLoading } = useQuery({
    queryKey: ['rider-earnings'],
    queryFn: () => api.analytics.getRiderEarnings(accessToken!),
    // Falls back to riders.getEarnings if analytics endpoint not available
    enabled: !!accessToken,
  })

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.topBar}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <ArrowLeft size={20} color="#111827" />
        </TouchableOpacity>
        <Text style={styles.title}>Earnings</Text>
      </View>

      {isLoading && <ActivityIndicator color="#16a34a" style={{ marginTop: 40 }} />}

      {data && (
        <>
          {/* Summary card */}
          <View style={styles.summaryCard}>
            <TrendingUp size={20} color="#16a34a" />
            <View>
              <Text style={styles.summaryAmount}>{formatPeso(data.totalEarnings)}</Text>
              <Text style={styles.summaryLabel}>Total earnings</Text>
            </View>
            <View style={styles.summaryDivider} />
            <View>
              <Text style={styles.summaryAmount}>{data.totalDeliveries}</Text>
              <Text style={styles.summaryLabel}>Deliveries</Text>
            </View>
          </View>

          <Text style={styles.sectionTitle}>Recent payouts</Text>

          <FlatList
            data={data.payouts ?? []}
            keyExtractor={(p, i) => `${p.date}-${i}`}
            contentContainerStyle={{ paddingHorizontal: 16, gap: 8 }}
            renderItem={({ item }) => (
              <View style={styles.payoutRow}>
                <View>
                  <Text style={styles.payoutDate}>{formatDate(item.date)}</Text>
                  <Text style={styles.payoutDeliveries}>{item.deliveries} deliveries</Text>
                </View>
                <Text style={styles.payoutAmount}>{formatPeso(item.amount)}</Text>
              </View>
            )}
            ListEmptyComponent={() => (
              <Text style={styles.emptyText}>No payouts yet</Text>
            )}
          />
        </>
      )}
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  topBar: { flexDirection: 'row', alignItems: 'center', padding: 16, gap: 12, borderBottomWidth: 1, borderBottomColor: '#f3f4f6' },
  backBtn: { padding: 4 },
  title: { fontSize: 18, fontWeight: '700', color: '#111827' },
  summaryCard: { flexDirection: 'row', alignItems: 'center', gap: 16, margin: 16, backgroundColor: '#f0fdf4', borderRadius: 14, padding: 16, borderWidth: 1, borderColor: '#bbf7d0' },
  summaryAmount: { fontSize: 20, fontWeight: '700', color: '#111827' },
  summaryLabel: { fontSize: 12, color: '#6b7280', marginTop: 2 },
  summaryDivider: { width: 1, height: 40, backgroundColor: '#bbf7d0' },
  sectionTitle: { fontSize: 15, fontWeight: '600', color: '#111827', paddingHorizontal: 16, marginBottom: 8 },
  payoutRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#f9fafb', borderRadius: 10, padding: 14, borderWidth: 1, borderColor: '#e5e7eb' },
  payoutDate: { fontSize: 14, fontWeight: '500', color: '#111827' },
  payoutDeliveries: { fontSize: 12, color: '#6b7280', marginTop: 2 },
  payoutAmount: { fontSize: 16, fontWeight: '700', color: '#16a34a' },
  emptyText: { textAlign: 'center', color: '#9ca3af', marginTop: 40, fontSize: 14 },
})
