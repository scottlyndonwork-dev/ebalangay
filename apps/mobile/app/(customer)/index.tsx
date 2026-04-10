import {
  View, Text, FlatList, TouchableOpacity, TextInput,
  StyleSheet, ActivityIndicator, Image,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { router } from 'expo-router'
import { useQuery } from '@tanstack/react-query'
import { MapPin, Search } from 'lucide-react-native'
import { api } from '@ebalangay/shared'
import { useAuthStore } from '@/stores/auth-store'
import { useCartStore } from '@/stores/cart-store'

function formatPeso(amount: number) {
  return `₱${amount.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

export default function CustomerHomeScreen() {
  const { accessToken } = useAuthStore()
  const addItem = useCartStore(s => s.addItem)

  const { data: merchants, isLoading } = useQuery({
    queryKey: ['merchants'],
    queryFn: () => api.merchants.list({}, accessToken!),
    enabled: !!accessToken,
  })

  const { data: featuredData } = useQuery({
    queryKey: ['featured-products'],
    queryFn: () => api.products.list({}, accessToken!),
    enabled: !!accessToken,
  })
  const featured = featuredData?.products

  return (
    <SafeAreaView style={styles.container}>
      <FlatList
        data={merchants ?? []}
        keyExtractor={m => m.id}
        ListHeaderComponent={() => (
          <View>
            {/* Header */}
            <View style={styles.header}>
              <View>
                <Text style={styles.greeting}>Good day!</Text>
                <View style={styles.locationRow}>
                  <MapPin size={14} color="#16a34a" />
                  <Text style={styles.location}>Butuan City</Text>
                </View>
              </View>
            </View>

            {/* Search bar */}
            <TouchableOpacity
              style={styles.searchBar}
              onPress={() => router.push('/(customer)/search')}
              activeOpacity={0.8}
            >
              <Search size={16} color="#9ca3af" />
              <Text style={styles.searchPlaceholder}>Search products or stores…</Text>
            </TouchableOpacity>

            {/* Featured products */}
            {featured && featured.length > 0 && (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Featured</Text>
                <FlatList
                  data={featured}
                  keyExtractor={p => p.id}
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={{ gap: 12, paddingHorizontal: 16 }}
                  renderItem={({ item }) => (
                    <TouchableOpacity style={styles.featuredCard} activeOpacity={0.85}>
                      {item.imageUrl && (
                        <Image source={{ uri: item.imageUrl }} style={styles.featuredImage} />
                      )}
                      <Text style={styles.featuredName} numberOfLines={1}>{item.name}</Text>
                      <Text style={styles.featuredPrice}>{formatPeso(item.price)}</Text>
                      <TouchableOpacity
                        style={styles.addBtn}
                        onPress={() => addItem({
                          productId: item.id,
                          name: item.name,
                          price: item.price,
                          imageUrl: item.imageUrl,
                          merchantId: item.merchantId,
                          merchantName: item.merchantName ?? '',
                        })}
                      >
                        <Text style={styles.addBtnText}>Add</Text>
                      </TouchableOpacity>
                    </TouchableOpacity>
                  )}
                />
              </View>
            )}

            <Text style={[styles.sectionTitle, { paddingHorizontal: 16, marginBottom: 8 }]}>Nearby stores</Text>
          </View>
        )}
        renderItem={({ item }) => (
          <TouchableOpacity
            style={styles.merchantCard}
            onPress={() => router.push({ pathname: '/(customer)/merchant/[id]', params: { id: item.id } })}
            activeOpacity={0.85}
          >
            {item.logoUrl && (
              <Image source={{ uri: item.logoUrl }} style={styles.merchantLogo} />
            )}
            <View style={styles.merchantInfo}>
              <Text style={styles.merchantName}>{item.name}</Text>
              <Text style={styles.merchantMeta}>{item.category ?? 'General'}</Text>
            </View>
            <View style={[styles.statusBadge, { backgroundColor: item.isOpen ? '#dcfce7' : '#f3f4f6' }]}>
              <Text style={[styles.statusText, { color: item.isOpen ? '#16a34a' : '#9ca3af' }]}>
                {item.isOpen ? 'Open' : 'Closed'}
              </Text>
            </View>
          </TouchableOpacity>
        )}
        ItemSeparatorComponent={() => <View style={{ height: 1, backgroundColor: '#f3f4f6', marginHorizontal: 16 }} />}
        ListEmptyComponent={() => (
          isLoading
            ? <ActivityIndicator color="#16a34a" style={{ marginTop: 40 }} />
            : <Text style={styles.emptyText}>No stores nearby yet</Text>
        )}
        contentContainerStyle={{ paddingBottom: 24 }}
      />
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', padding: 16, paddingBottom: 8 },
  greeting: { fontSize: 20, fontWeight: '700', color: '#111827' },
  locationRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 },
  location: { fontSize: 13, color: '#6b7280' },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginHorizontal: 16,
    marginBottom: 16,
    backgroundColor: '#f9fafb',
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 11,
  },
  searchPlaceholder: { color: '#9ca3af', fontSize: 14 },
  section: { marginBottom: 20 },
  sectionTitle: { fontSize: 16, fontWeight: '600', color: '#111827', marginBottom: 12, paddingHorizontal: 16 },
  featuredCard: { width: 140, backgroundColor: '#fff', borderRadius: 12, borderWidth: 1, borderColor: '#e5e7eb', overflow: 'hidden' },
  featuredImage: { width: '100%', height: 90, resizeMode: 'cover' },
  featuredName: { fontSize: 13, fontWeight: '500', color: '#111827', paddingHorizontal: 10, paddingTop: 8 },
  featuredPrice: { fontSize: 12, color: '#16a34a', fontWeight: '600', paddingHorizontal: 10, marginTop: 2 },
  addBtn: { margin: 10, backgroundColor: '#16a34a', borderRadius: 6, paddingVertical: 6, alignItems: 'center' },
  addBtnText: { color: '#fff', fontSize: 12, fontWeight: '600' },
  merchantCard: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 14, gap: 12 },
  merchantLogo: { width: 48, height: 48, borderRadius: 10, backgroundColor: '#f3f4f6' },
  merchantInfo: { flex: 1 },
  merchantName: { fontSize: 15, fontWeight: '600', color: '#111827' },
  merchantMeta: { fontSize: 13, color: '#6b7280', marginTop: 2 },
  statusBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 99 },
  statusText: { fontSize: 12, fontWeight: '500' },
  emptyText: { textAlign: 'center', color: '#9ca3af', marginTop: 60, fontSize: 14 },
})
