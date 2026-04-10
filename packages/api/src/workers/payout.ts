import { Worker } from 'bullmq'
import redis from '../lib/redis.js'
import prisma from '../lib/prisma.js'
import { notificationQueue } from '../queues/index.js'
import type { PayoutJob } from '../queues/index.js'
import { createTransfer } from '../services/paymongo.js'
import { generateWeeklySummary } from '../services/ai.js'
import { RIDER_CUT } from '../lib/commission.js'

// ─── Logger type (matches Fastify's pino logger subset) ───────────────────────

type Logger = {
  info: (msg: string) => void
  warn: (msg: string) => void
  error: (msg: string, ...args: unknown[]) => void
}

// ─── Worker bootstrap ─────────────────────────────────────────────────────────

export function startPayoutWorker(logger: Logger): void {
  const worker = new Worker<PayoutJob>(
    'payout',
    async (job) => {
      if (job.name === 'daily-payout') {
        await processDailyPayouts(logger)
      } else if (job.name === 'weekly-summary') {
        await processWeeklySummaries(logger)
      }
    },
    {
      connection: redis,
      concurrency: 1,
    }
  )

  worker.on('failed', (job, err) => {
    logger.error(`Payout worker job "${job?.name}" failed`, err)
  })

  worker.on('error', (err) => {
    logger.error('Payout worker error', err)
  })

  logger.info('Payout worker started')
}

// ─── Daily payouts ────────────────────────────────────────────────────────────

async function processDailyPayouts(logger: Logger): Promise<void> {
  const deliveries = await prisma.delivery.findMany({
    where: {
      payoutProcessed: false,
      status: 'delivered',
    },
    include: {
      order: {
        include: {
          merchant: {
            select: { id: true, ownerId: true, name: true, payoutGcash: true, type: true },
          },
        },
      },
      rider: {
        include: { riderProfile: { select: { gcashNumber: true } } },
      },
    },
  })

  logger.info(`Processing payouts for ${deliveries.length} delivered order(s)`)

  for (const delivery of deliveries) {
    try {
      const { order } = delivery

      // Merchant payout: subtotal minus platform commission (in centavos)
      const merchantNet = Number(order.subtotal) - Number(order.commission)
      const merchantCentavos = Math.round(merchantNet * 100)

      // Rider payout: deliveryFee × RIDER_CUT (in centavos)
      const riderCentavos = Math.round(Number(order.deliveryFee) * RIDER_CUT * 100)

      const orderRef = order.id.slice(-8).toUpperCase()

      // Transfer to merchant
      if (order.merchant.payoutGcash && merchantCentavos > 0) {
        try {
          await createTransfer({
            amount: merchantCentavos,
            currency: 'PHP',
            sendTo: { type: 'gcash', mobileNumber: order.merchant.payoutGcash },
            remarks: `eBalangay payout – Order ${orderRef}`,
          })
        } catch (err) {
          // Log and skip — do not block rider payout or DB update
          logger.error(`Merchant transfer failed for order ${order.id} — queued for next run`, err)
          continue
        }
      }

      // Transfer to rider
      if (delivery.riderId && delivery.rider?.riderProfile?.gcashNumber && riderCentavos > 0) {
        try {
          await createTransfer({
            amount: riderCentavos,
            currency: 'PHP',
            sendTo: {
              type: 'gcash',
              mobileNumber: delivery.rider.riderProfile.gcashNumber,
            },
            remarks: `eBalangay delivery payout – Order ${orderRef}`,
          })
        } catch (err) {
          logger.error(`Rider transfer failed for order ${order.id}`, err)
          // Continue — merchant was already paid; mark processed anyway to avoid double payout
        }
      }

      // Mark payout as processed
      await prisma.delivery.update({
        where: { id: delivery.id },
        data: { payoutProcessed: true },
      })

      // Notify merchant
      await notificationQueue.add('payout-sent', {
        userId: order.merchant.ownerId,
        title: 'Payout Sent',
        body: `Your payout of ₱${merchantNet.toFixed(2)} for order #${orderRef} has been sent to your GCash.`,
        type: 'payout',
        data: { orderId: order.id, amount: String(merchantCentavos) },
      })

      // Notify rider
      if (delivery.riderId) {
        await notificationQueue.add('payout-sent', {
          userId: delivery.riderId,
          title: 'Delivery Payout Sent',
          body: `Your delivery earnings of ₱${(riderCentavos / 100).toFixed(2)} for order #${orderRef} have been sent to your GCash.`,
          type: 'payout',
          data: { orderId: order.id, amount: String(riderCentavos) },
        })
      }
    } catch (err) {
      // Catch-all so one bad delivery never aborts the rest
      logger.error(`Payout processing failed for delivery ${delivery.id}`, err)
    }
  }

  logger.info('Daily payout run complete')
}

// ─── Weekly summaries ─────────────────────────────────────────────────────────

async function processWeeklySummaries(logger: Logger): Promise<void> {
  const merchants = await prisma.business.findMany({
    where: { isVerified: true },
    select: { id: true, ownerId: true, name: true },
  })

  logger.info(`Generating weekly summaries for ${merchants.length} merchant(s)`)

  for (const merchant of merchants) {
    try {
      const summary = await generateWeeklySummary(merchant.id)

      await notificationQueue.add('weekly-summary', {
        userId: merchant.ownerId,
        title: `Weekly Summary — ${merchant.name}`,
        body: summary,
        type: 'weekly_summary',
      })
    } catch (err) {
      logger.error(`Weekly summary failed for merchant ${merchant.id}`, err)
    }
  }

  logger.info('Weekly summary run complete')
}
