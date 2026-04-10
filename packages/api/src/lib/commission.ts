import { Prisma } from '@prisma/client'

// ─── Constants ────────────────────────────────────────────────────────────────

export const COMMISSION_RATES: Record<string, number> = {
  RESTAURANT: 0.10, // food 10%
  RETAIL: 0.08,     // grocery 8%
  HARDWARE: 0.08,   // 8%
  PHARMACY: 0.09,   // 9%
  WHOLESALE: 0.08,
  DISTRIBUTOR: 0.08,
}

export const DEFAULT_COMMISSION_RATE = 0.10

/** PHP flat base delivery fee */
export const DELIVERY_BASE = 40

/** PHP per km after the base */
export const DELIVERY_PER_KM = 8

/** Rider receives 85% of delivery fee; platform keeps 15% */
export const RIDER_CUT = 0.85

// ─── Haversine ────────────────────────────────────────────────────────────────

/**
 * Returns straight-line distance in km between two GPS coordinates.
 */
export function haversineKm(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number
): number {
  const R = 6371 // Earth radius in km
  const dLat = toRad(lat2 - lat1)
  const dLng = toRad(lng2 - lng1)
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

function toRad(deg: number): number {
  return (deg * Math.PI) / 180
}

// ─── Fee & commission calculators ────────────────────────────────────────────

/**
 * Delivery fee = DELIVERY_BASE + DELIVERY_PER_KM × distance.
 * Minimum is always DELIVERY_BASE.
 */
export function calculateDeliveryFee(distanceKm: number): Prisma.Decimal {
  const fee = DELIVERY_BASE + DELIVERY_PER_KM * distanceKm
  return new Prisma.Decimal(fee.toFixed(2))
}

/**
 * Platform commission based on business type.
 */
export function calculateCommission(
  subtotal: Prisma.Decimal,
  businessType: string
): Prisma.Decimal {
  const rate = COMMISSION_RATES[businessType] ?? DEFAULT_COMMISSION_RATE
  return subtotal.mul(new Prisma.Decimal(rate)).toDecimalPlaces(2)
}

/**
 * Splits delivery fee between rider and platform.
 */
export function calculatePayouts(deliveryFee: Prisma.Decimal): {
  riderPayout: Prisma.Decimal
  platformCut: Prisma.Decimal
} {
  const riderPayout = deliveryFee
    .mul(new Prisma.Decimal(RIDER_CUT))
    .toDecimalPlaces(2)
  const platformCut = deliveryFee.minus(riderPayout)
  return { riderPayout, platformCut }
}
