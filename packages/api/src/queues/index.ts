import { Queue } from 'bullmq'
import redis from '../lib/redis.js'

// ─── Job types ────────────────────────────────────────────────────────────────

export interface RestockAlertJob {
  productId: string
  businessId: string
  currentStock: number
  productName: string
}

export interface NotificationJob {
  userId: string
  title: string
  body: string
  type: string
  metadata?: Record<string, unknown>
  /** Firebase data payload — string values only */
  data?: Record<string, string>
}

export interface PayoutJob {
  /** Optional for cron-triggered batch jobs */
  businessId?: string
  periodStart?: string
  periodEnd?: string
}

export interface DispatchJob {
  orderId: string
  deliveryId: string
  pickupLat: number
  pickupLng: number
  dropoffLat: number
  dropoffLng: number
  attempt: number
  /** Populated for offer-timeout jobs */
  currentRiderId?: string
  /** Remaining riders to try after current offer expires */
  fallbackRiderIds?: string[]
}

// ─── Queue singletons ─────────────────────────────────────────────────────────

export const inventoryQueue = new Queue<RestockAlertJob>('inventory', {
  connection: redis,
  defaultJobOptions: {
    attempts: 3,
    backoff: { type: 'exponential', delay: 2000 },
    removeOnComplete: { age: 3600 },
    removeOnFail: { age: 86400 },
  },
})

export const payoutQueue = new Queue<PayoutJob>('payout', {
  connection: redis,
  defaultJobOptions: {
    attempts: 3,
    backoff: { type: 'exponential', delay: 5000 },
    removeOnComplete: { age: 3600 },
    removeOnFail: { age: 86400 * 7 },
  },
})

export const dispatchQueue = new Queue<DispatchJob>('dispatch', {
  connection: redis,
  defaultJobOptions: {
    attempts: 5,
    backoff: { type: 'exponential', delay: 1000 },
    removeOnComplete: { age: 3600 },
    removeOnFail: { age: 86400 },
  },
})

export const notificationQueue = new Queue<NotificationJob>('notification', {
  connection: redis,
  defaultJobOptions: {
    attempts: 3,
    backoff: { type: 'exponential', delay: 1000 },
    removeOnComplete: { age: 7200 },
    removeOnFail: { age: 86400 },
  },
})

// ─── Worker bootstrap ─────────────────────────────────────────────────────────

export async function startWorkers(logger: {
  info: (msg: string) => void
  warn: (msg: string) => void
  error: (msg: string, ...args: unknown[]) => void
}): Promise<void> {
  try {
    const { startInventoryWorker } = await import('../workers/inventory.js')
    startInventoryWorker(logger)
    const { startDispatchWorker } = await import('../workers/dispatch.js')
    startDispatchWorker(logger)
    const { startPayoutWorker } = await import('../workers/payout.js')
    startPayoutWorker(logger)
    const { startNotificationWorker } = await import('../services/notifications.js')
    startNotificationWorker(logger)
    logger.info('All workers started')
  } catch (err) {
    logger.error('Failed to start workers', err)
  }
}

/**
 * Register repeating BullMQ cron jobs.
 * Safe to call on every startup — BullMQ deduplicates by pattern.
 */
export async function scheduleRecurringJobs(): Promise<void> {
  await payoutQueue.add(
    'daily-payout',
    {},
    { repeat: { pattern: '0 22 * * *', tz: 'Asia/Manila' } }
  )
  await payoutQueue.add(
    'weekly-summary',
    {},
    { repeat: { pattern: '0 8 * * 1', tz: 'Asia/Manila' } }
  )
}
