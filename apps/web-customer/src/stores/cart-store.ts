'use client'
import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { Product } from '@ebalangay/shared'

export interface CartItem {
  product: Product
  quantity: number
}

interface CartState {
  items: CartItem[]
  merchantId: string | null
  addItem: (product: Product, quantity?: number) => void
  removeItem: (productId: string) => void
  updateQty: (productId: string, quantity: number) => void
  clearCart: () => void
  total: () => number
  itemCount: () => number
}

export const useCartStore = create<CartState>()(
  persist(
    (set, get) => ({
      items: [],
      merchantId: null,

      addItem: (product, quantity = 1) =>
        set((state) => {
          // If adding from a different merchant, clear cart first
          if (state.merchantId && state.merchantId !== product.businessId) {
            return {
              items: [{ product, quantity }],
              merchantId: product.businessId,
            }
          }
          const existing = state.items.find((i) => i.product.id === product.id)
          if (existing) {
            return {
              items: state.items.map((i) =>
                i.product.id === product.id
                  ? { ...i, quantity: i.quantity + quantity }
                  : i
              ),
              merchantId: product.businessId,
            }
          }
          return {
            items: [...state.items, { product, quantity }],
            merchantId: product.businessId,
          }
        }),

      removeItem: (productId) =>
        set((state) => ({
          items: state.items.filter((i) => i.product.id !== productId),
          merchantId: state.items.length === 1 ? null : state.merchantId,
        })),

      updateQty: (productId, quantity) =>
        set((state) => ({
          items:
            quantity <= 0
              ? state.items.filter((i) => i.product.id !== productId)
              : state.items.map((i) =>
                  i.product.id === productId ? { ...i, quantity } : i
                ),
        })),

      clearCart: () => set({ items: [], merchantId: null }),

      total: () =>
        get().items.reduce((sum, i) => sum + i.product.price * i.quantity, 0),

      itemCount: () =>
        get().items.reduce((sum, i) => sum + i.quantity, 0),
    }),
    { name: 'eb-cart' }
  )
)
