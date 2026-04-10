import { useState } from 'react'
import {
  View, Text, FlatList, TouchableOpacity, Image,
  StyleSheet, ActivityIndicator, Alert,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { router } from 'expo-router'
import { Minus, Plus, Trash2 } from 'lucide-react-native'
import { useMutation } from '@tanstack/react-query'
import { api } from '@ebalangay/shared'
import { useAuthStore } from '@/stores/auth-store'
import { useCartStore } from '@/stores/cart-store'

function formatPeso(amount: number) {
  return `₱${amount.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

const DELIVERY_FEE = 49

export default function CartScreen() {
  const { accessToken } = useAuthStore()
  const { items, updateQty, removeItem, clearCart, merchantId, total } = useCartStore()

  const { mutate: checkout, isPending } = useMutation({
    mutationFn: () =>
      api.orders.create({
        merchantId: merchantId!,
        items: items.map(i => ({ productId: i.productId, quantity: i.quantity })),
        addressLine: 'Butuan City',
        barangay: 'Butuan City',
      }, accessToken!),
    onSuccess: (order) => {
      clearCart()
      router.push({ pathname: '/(customer)/orders/[id]/track', params: { id: order.id } })
    },
    onError: () => Alert.alert('Checkout failed', 'Please try again.'),
  })

  if (items.length === 0) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.title}>My cart</Text>
        </View>
        <View style={styles.emptyState}>
          <Text style={styles.emptyIcon}>🛒</Text>
          <Text style={styles.emptyTitle}>Your cart is empty</Text>
          <Text style={styles.emptySubtitle}>Browse stores and add items to get started</Text>
        </View>
      </SafeAreaView>
    )
  }

  const subtotal = total()

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>My cart</Text>
        <Text style={styles.storeName}>{items[0]?.merchantName}</Text>
      </View>

      <FlatList
        data={items}
        keyExtractor={i => i.productId}
        contentContainerStyle={{ padding: 16, gap: 12 }}
        renderItem={({ item }) => (
          <View style={styles.cartItem}>
            {item.imageUrl && (
              <Image source={{ uri: item.imageUrl }} style={styles.itemImage} />
            )}
            <View style={styles.itemInfo}>
              <Text style={styles.itemName} numberOfLines={2}>{item.name}</Text>
              <Text style={styles.itemPrice}>{formatPeso(item.price)}</Text>
            </View>
            <View style={styles.qtyControls}>
              <TouchableOpacity
                style={styles.qtyBtn}
                onPress={() => item.quantity === 1 ? removeItem(item.productId) : updateQty(item.productId, item.quantity - 1)}
              >
                {item.quantity === 1
                  ? <Trash2 size={14} color="#ef4444" />
                  : <Minus size={14} color="#16a34a" />
                }
              </TouchableOpacity>
              <Text style={styles.qty}>{item.quantity}</Text>
              <TouchableOpacity style={styles.qtyBtn} onPress={() => updateQty(item.productId, item.quantity + 1)}>
                <Plus size={14} color="#16a34a" />
              </TouchableOpacity>
            </View>
          </View>
        )}
      />

      <View style={styles.summary}>
        <View style={styles.summaryRow}>
          <Text style={styles.summaryLabel}>Subtotal</Text>
          <Text style={styles.summaryValue}>{formatPeso(subtotal)}</Text>
        </View>
        <View style={styles.summaryRow}>
          <Text style={styles.summaryLabel}>Delivery fee</Text>
          <Text style={styles.summaryValue}>{formatPeso(DELIVERY_FEE)}</Text>
        </View>
        <View style={[styles.summaryRow, styles.totalRow]}>
          <Text style={styles.totalLabel}>Total</Text>
          <Text style={styles.totalValue}>{formatPeso(subtotal + DELIVERY_FEE)}</Text>
        </View>

        <TouchableOpacity
          style={[styles.checkoutBtn, isPending && styles.btnDisabled]}
          onPress={() => checkout()}
          disabled={isPending}
        >
          {isPending
            ? <ActivityIndicator color="#fff" />
            : <Text style={styles.checkoutBtnText}>Place order · {formatPeso(subtotal + DELIVERY_FEE)}</Text>
          }
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  header: { padding: 16, paddingBottom: 8, borderBottomWidth: 1, borderBottomColor: '#f3f4f6' },
  title: { fontSize: 20, fontWeight: '700', color: '#111827' },
  storeName: { fontSize: 13, color: '#6b7280', marginTop: 2 },
  emptyState: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  emptyIcon: { fontSize: 48 },
  emptyTitle: { fontSize: 18, fontWeight: '600', color: '#111827', marginTop: 16 },
  emptySubtitle: { fontSize: 14, color: '#9ca3af', textAlign: 'center', marginTop: 8 },
  cartItem: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: '#f9fafb', borderRadius: 12, padding: 12 },
  itemImage: { width: 56, height: 56, borderRadius: 8, backgroundColor: '#e5e7eb' },
  itemInfo: { flex: 1 },
  itemName: { fontSize: 14, fontWeight: '500', color: '#111827' },
  itemPrice: { fontSize: 13, color: '#16a34a', fontWeight: '600', marginTop: 4 },
  qtyControls: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  qtyBtn: { width: 30, height: 30, borderRadius: 8, backgroundColor: '#fff', borderWidth: 1, borderColor: '#e5e7eb', alignItems: 'center', justifyContent: 'center' },
  qty: { fontSize: 15, fontWeight: '600', color: '#111827', minWidth: 20, textAlign: 'center' },
  summary: { padding: 16, borderTopWidth: 1, borderTopColor: '#f3f4f6', gap: 10 },
  summaryRow: { flexDirection: 'row', justifyContent: 'space-between' },
  summaryLabel: { fontSize: 14, color: '#6b7280' },
  summaryValue: { fontSize: 14, color: '#111827' },
  totalRow: { paddingTop: 10, borderTopWidth: 1, borderTopColor: '#e5e7eb' },
  totalLabel: { fontSize: 16, fontWeight: '700', color: '#111827' },
  totalValue: { fontSize: 16, fontWeight: '700', color: '#111827' },
  checkoutBtn: { backgroundColor: '#16a34a', borderRadius: 12, paddingVertical: 14, alignItems: 'center' },
  btnDisabled: { opacity: 0.6 },
  checkoutBtnText: { color: '#fff', fontWeight: '700', fontSize: 16 },
})
