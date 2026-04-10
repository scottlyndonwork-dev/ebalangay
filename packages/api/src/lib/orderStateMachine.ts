/**
 * Order State Machine
 * Enforces strict state transitions for orders
 */

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

export const VALID_TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  [OrderStatus.PLACED]: [OrderStatus.CONFIRMED, OrderStatus.CANCELLED],
  [OrderStatus.CONFIRMED]: [OrderStatus.PREPARING, OrderStatus.CANCELLED],
  [OrderStatus.PREPARING]: [OrderStatus.READY_FOR_PICKUP],
  [OrderStatus.READY_FOR_PICKUP]: [OrderStatus.PICKED_UP],
  [OrderStatus.PICKED_UP]: [OrderStatus.IN_TRANSIT],
  [OrderStatus.IN_TRANSIT]: [OrderStatus.DELIVERED, OrderStatus.FAILED],
  [OrderStatus.DELIVERED]: [],
  [OrderStatus.CANCELLED]: [],
  [OrderStatus.FAILED]: [],
}

/**
 * Validate state transition
 */
export function validateTransition(from: OrderStatus | string, to: OrderStatus | string): void {
  const fromStatus = from as OrderStatus
  const toStatus = to as OrderStatus

  const allowed = VALID_TRANSITIONS[fromStatus] ?? []

  if (!allowed.includes(toStatus)) {
    throw new Error(
      `Invalid order status transition: ${from} → ${to}. Allowed: ${allowed.join(', ') || 'none (terminal state)'}`
    )
  }
}

/**
 * Check if status is terminal (no more transitions allowed)
 */
export function isTerminalStatus(status: OrderStatus | string): boolean {
  return VALID_TRANSITIONS[status as OrderStatus]?.length === 0
}

/**
 * Get allowed next statuses for current status
 */
export function getAllowedNextStatuses(status: OrderStatus | string): OrderStatus[] {
  return VALID_TRANSITIONS[status as OrderStatus] ?? []
}

/**
 * Check if an order in this status can be cancelled
 * Only PLACED and CONFIRMED orders can be cancelled
 */
export function canCancel(status: OrderStatus | string): boolean {
  return [OrderStatus.PLACED, OrderStatus.CONFIRMED].includes(status as OrderStatus)
}
