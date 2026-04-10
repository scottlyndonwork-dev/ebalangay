import { create } from 'zustand'

export interface CartItem {
  productId: string
  name: string
  price: number
  quantity: number
  imageUrl?: string
  merchantId: string
  merchantName: string
}

interface CartState {
  items: CartItem[]
  merchantId: string | null
  merchantName: string | null
  addItem: (item: Omit<CartItem, 'quantity'>) => void
  removeItem: (productId: string) => void
  updateQty: (productId: string, quantity: number) => void
  clearCart: () => void
  total: () => number
  itemCount: () => number
}

export const useCartStore = create<CartState>((set, get) => ({
  items: [],
  merchantId: null,
  merchantName: null,

  addItem: (item) => {
    const { items, merchantId } = get()
    if (merchantId && merchantId !== item.merchantId) {
      // Cross-merchant conflict: clear and start fresh
      set({
        items: [{ ...item, quantity: 1 }],
        merchantId: item.merchantId,
        merchantName: item.merchantName,
      })
      return
    }
    const existing = items.find(i => i.productId === item.productId)
    if (existing) {
      set({ items: items.map(i => i.productId === item.productId ? { ...i, quantity: i.quantity + 1 } : i) })
    } else {
      set({
        items: [...items, { ...item, quantity: 1 }],
        merchantId: item.merchantId,
        merchantName: item.merchantName,
      })
    }
  },

  removeItem: (productId) => {
    const items = get().items.filter(i => i.productId !== productId)
    set({ items, merchantId: items.length === 0 ? null : get().merchantId, merchantName: items.length === 0 ? null : get().merchantName })
  },

  updateQty: (productId, quantity) => {
    if (quantity <= 0) {
      get().removeItem(productId)
      return
    }
    set({ items: get().items.map(i => i.productId === productId ? { ...i, quantity } : i) })
  },

  clearCart: () => set({ items: [], merchantId: null, merchantName: null }),

  total: () => get().items.reduce((sum, i) => sum + i.price * i.quantity, 0),

  itemCount: () => get().items.reduce((sum, i) => sum + i.quantity, 0),
}))
