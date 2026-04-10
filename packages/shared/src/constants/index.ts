export const REGIONS = {
  CARAGA: 'Caraga',
} as const

export const CITIES = {
  BUTUAN: 'Butuan City',
} as const

export const DEFAULT_LOCATION = {
  latitude: 8.9475,
  longitude: 125.5406,
  city: CITIES.BUTUAN,
  region: REGIONS.CARAGA,
} as const

export const ORDER_STATUS_LABELS: Record<string, string> = {
  PENDING: 'Pending',
  CONFIRMED: 'Confirmed',
  PREPARING: 'Preparing',
  READY_FOR_PICKUP: 'Ready for Pickup',
  PICKED_UP: 'Picked Up',
  IN_TRANSIT: 'On the Way',
  DELIVERED: 'Delivered',
  CANCELLED: 'Cancelled',
  REFUNDED: 'Refunded',
}

export const MERCHANT_CATEGORY_LABELS: Record<string, string> = {
  SARI_SARI: 'Sari-sari Store',
  RESTAURANT: 'Restaurant / Carinderia',
  HARDWARE: 'Hardware Store',
  PHARMACY: 'Pharmacy',
  WHOLESALE: 'Wholesale Supplier',
  OTHER: 'Other',
}

export const PAYMENT_METHOD_LABELS: Record<string, string> = {
  GCASH: 'GCash',
  MAYA: 'Maya',
  CARD: 'Credit / Debit Card',
  CASH_ON_DELIVERY: 'Cash on Delivery',
}

export const MAX_UPLOAD_SIZE_MB = 5
export const ACCEPTED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp']
