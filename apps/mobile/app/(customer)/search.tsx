import { useState } from 'react'
import {
  View, Text, TextInput, FlatList, TouchableOpacity,
  StyleSheet, ActivityIndicator, Image,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useQuery } from '@tanstack/react-query'
import { Search as SearchIcon } from 'lucide-react-native'
import { api } from '@ebalangay/shared'
import { useAuthStore } from '@/stores/auth-store'
import { useCartStore } from '@/stores/cart-store'

function formatPeso(amount: number) {
  return `₱${amount.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

export default function SearchScreen() {
  const { accessToken } = useAuthStore()
  const addItem = useCartStore(s => s.addItem)
  const [query, setQuery] = useState('')
  const [submitted, setSubmitted] = useState('')

  const { data: results, isFetching } = useQuery({
    queryKey: ['product-search', submitted],
    queryFn: async () => {
      const res = await api.products.list({ search: submitted }, accessToken!)
      return res.products
    },
    enabled: !!accessToken && submitted.length > 0,
  })

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <View style={styles.searchBar}>
          <SearchIcon size={16} color="#9ca3af" />
          <TextInput
            style={styles.input}
            placeholder="Search products…"
            value={query}
            onChangeText={setQuery}
            onSubmitEditing={() => setSubmitted(query.trim())}
            returnKeyType="search"
            autoFocus
          />
          {isFetching && <ActivityIndicator size="small" color="#16a34a" />}
        </View>
      </View>

      <FlatList
        data={results ?? []}
        keyExtractor={p => p.id}
        numColumns={2}
        columnWrapperStyle={{ gap: 12, paddingHorizontal: 16 }}
        contentContainerStyle={{ paddingVertical: 16, gap: 12 }}
        ListEmptyComponent={() => (
          submitted
            ? <Text style={styles.emptyText}>No products found for "{submitted}"</Text>
            : <Text style={styles.emptyText}>Search for products above</Text>
        )}
        renderItem={({ item }) => (
          <View style={styles.card}>
            {item.imageUrl && (
              <Image source={{ uri: item.imageUrl }} style={styles.image} />
            )}
            <View style={styles.cardBody}>
              <Text style={styles.productName} numberOfLines={2}>{item.name}</Text>
              <Text style={styles.merchantName} numberOfLines={1}>{item.merchantName}</Text>
              <View style={styles.cardFooter}>
                <Text style={styles.price}>{formatPeso(item.price)}</Text>
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
                  <Text style={styles.addBtnText}>+</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        )}
      />
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  header: { padding: 16, borderBottomWidth: 1, borderBottomColor: '#f3f4f6' },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#f9fafb',
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  input: { flex: 1, fontSize: 15, color: '#111827' },
  card: { flex: 1, backgroundColor: '#fff', borderRadius: 12, borderWidth: 1, borderColor: '#e5e7eb', overflow: 'hidden' },
  image: { width: '100%', height: 110, resizeMode: 'cover' },
  cardBody: { padding: 10 },
  productName: { fontSize: 13, fontWeight: '600', color: '#111827', marginBottom: 2 },
  merchantName: { fontSize: 11, color: '#9ca3af', marginBottom: 8 },
  cardFooter: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  price: { fontSize: 13, fontWeight: '700', color: '#16a34a' },
  addBtn: { width: 28, height: 28, borderRadius: 14, backgroundColor: '#16a34a', alignItems: 'center', justifyContent: 'center' },
  addBtnText: { color: '#fff', fontSize: 18, lineHeight: 20 },
  emptyText: { textAlign: 'center', color: '#9ca3af', marginTop: 60, fontSize: 14 },
})
