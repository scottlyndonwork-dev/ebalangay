import {
  View, Text, FlatList, TouchableOpacity,
  StyleSheet, ActivityIndicator,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { router } from 'expo-router'
import { useQuery } from '@tanstack/react-query'
import { ChevronRight } from 'lucide-react-native'
import { api } from '@ebalangay/shared'
import { useAuthStore } from '@/stores/auth-store'

function formatPeso(amount: number) {
  return `₱${amount.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

const STATUS_COLORS: Record<string, { bg: string; text: string }> = {
  PLACED: { bg: '#fef9c3', text: '#854d0e' },
  CONFIRMED: { bg: '#dbeafe', text: '#1e40af' },
  PREPARING: { bg: '#fef3c7', text: '#92400e' },
  READY_FOR_PICKUP: { bg: '#f3e8ff', text: '#6b21a8' },
  OUT_FOR_DELIVERY: { bg: '#dcfce7', text: '#166534' },
  DELIVERED: { bg: '#f0fdf4', text: '#166534' },
  CANCELLED: { bg: '#fee2e2', text: '#991b1b' },
}

function statusLabel(status: string) {
  return status.replace(/_/g, ' ')
}

export default function OrdersScreen() {
  const { accessToken } = useAuthStore()

  const { data: orders, isLoading } = useQuery({
    queryKey: ['customer-orders'],
    queryFn: async () => {
      const res = await api.orders.list({}, accessToken!)
      return res.orders
    },
    enabled: !!accessToken,
    refetchInterval: 30_000,
  })

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>My orders</Text>
      </View>

      {isLoading && <ActivityIndicator color="#16a34a" style={{ marginTop: 40 }} />}

      <FlatList
        data={orders ?? []}
        keyExtractor={o => o.id}
        contentContainerStyle={{ padding: 16, gap: 12 }}
        renderItem={({ item }) => {
          const statusStyle = STATUS_COLORS[item.status] ?? { bg: '#f3f4f6', text: '#6b7280' }
          const isActive = !['DELIVERED', 'CANCELLED'].includes(item.status)

          return (
            <TouchableOpacity
              style={styles.orderCard}
              onPress={() => isActive
                ? router.push({ pathname: '/(customer)/orders/[id]/track', params: { id: item.id } })
                : undefined
              }
              activeOpacity={isActive ? 0.8 : 1}
            >
              <View style={styles.orderHeader}>
                <Text style={styles.orderId}>Order #{item.id.slice(-6).toUpperCase()}</Text>
                <View style={[styles.statusBadge, { backgroundColor: statusStyle.bg }]}>
                  <Text style={[styles.statusText, { color: statusStyle.text }]}>{statusLabel(item.status)}</Text>
                </View>
              </View>
              <Text style={styles.merchantName}>{item.merchantName}</Text>
              <View style={styles.orderFooter}>
                <Text style={styles.total}>{formatPeso(item.total)}</Text>
                {isActive && <ChevronRight size={16} color="#9ca3af" />}
              </View>
            </TouchableOpacity>
          )
        }}
        ListEmptyComponent={() => (
          !isLoading ? (
            <View style={styles.emptyState}>
              <Text style={styles.emptyIcon}>📦</Text>
              <Text style={styles.emptyTitle}>No orders yet</Text>
              <Text style={styles.emptySubtitle}>Browse stores and place your first order</Text>
            </View>
          ) : null
        )}
      />
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  header: { padding: 16, paddingBottom: 8, borderBottomWidth: 1, borderBottomColor: '#f3f4f6' },
  title: { fontSize: 20, fontWeight: '700', color: '#111827' },
  orderCard: { backgroundColor: '#f9fafb', borderRadius: 12, padding: 14, borderWidth: 1, borderColor: '#e5e7eb' },
  orderHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 },
  orderId: { fontSize: 14, fontWeight: '700', color: '#111827' },
  statusBadge: { paddingHorizontal: 10, paddingVertical: 3, borderRadius: 99 },
  statusText: { fontSize: 11, fontWeight: '600' },
  merchantName: { fontSize: 13, color: '#6b7280', marginBottom: 10 },
  orderFooter: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  total: { fontSize: 15, fontWeight: '700', color: '#111827' },
  emptyState: { alignItems: 'center', paddingTop: 60 },
  emptyIcon: { fontSize: 48 },
  emptyTitle: { fontSize: 18, fontWeight: '600', color: '#111827', marginTop: 16 },
  emptySubtitle: { fontSize: 14, color: '#9ca3af', textAlign: 'center', marginTop: 8 },
})
