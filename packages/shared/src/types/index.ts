export enum UserRole {
  CUSTOMER = 'CUSTOMER',
  MERCHANT = 'MERCHANT',
  RIDER = 'RIDER',
  ADMIN = 'ADMIN',
}

export enum BusinessType {
  RETAIL = 'RETAIL',
  RESTAURANT = 'RESTAURANT',
  PHARMACY = 'PHARMACY',
  HARDWARE = 'HARDWARE',
  WHOLESALE = 'WHOLESALE',
  DISTRIBUTOR = 'DISTRIBUTOR',
}

export enum OrderStatus {
  PLACED = 'PLACED',
  CONFIRMED = 'CONFIRMED',
  PREPARING = 'PREPARING',
  READY_FOR_PICKUP = 'READY_FOR_PICKUP',
  PICKED_UP = 'PICKED_UP',
  IN_TRANSIT = 'IN_TRANSIT',
  DELIVERED = 'DELIVERED',
  CANCELLED = 'CANCELLED',
  FAILED = 'FAILED',
}

export type UserStatus = 'ACTIVE' | 'SUSPENDED' | 'PENDING_VERIFICATION'

export type PaymentMethod = 'GCASH' | 'MAYA' | 'CARD' | 'CASH_ON_DELIVERY'
export type PaymentStatus = 'PENDING' | 'PAID' | 'FAILED' | 'REFUNDED'

export type RiderStatus = 'OFFLINE' | 'ONLINE' | 'BUSY'

export interface ApiResponse<T> {
  success: boolean
  data?: T
  error?: string
}

export interface PaginatedResponse<T> {
  data: T[]
  meta: {
    total: number
    page: number
    limit: number
    totalPages: number
  }
}

export interface ApiError {
  statusCode: number
  error: string
  message: string
}

export interface GeoPoint {
  latitude: number
  longitude: number
}
