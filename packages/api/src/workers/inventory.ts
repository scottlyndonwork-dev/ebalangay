import { Worker, Job } from 'bullmq'
import Anthropic from '@anthropic-ai/sdk'
import prisma from '../lib/prisma.js'
import redis from '../lib/redis.js'
import { inventoryQueue, notificationQueue } from '../queues/index.js'
import type { RestockAlertJob, NotificationJob } from '../queues/index.js'

// ─── Worker ───────────────────────────────────────────────────────────────────

export function startInventoryWorker(logger: {
  info: (msg: string) => void
  error: (msg: string, ...args: unknown[]) => void
}): Worker<RestockAlertJob> {
  const worker = new Worker<RestockAlertJob>(
    'inventory',
    async (job: Job<RestockAlertJob>) => {
      const { productId, currentStock, productName } = job.data
      logger.info(`Processing restock alert for ${productName} (${productId})`)

      // 1. Fetch product + business owner
      const product = await prisma.product.findUnique({
        where: { id: productId },
        include: { business: { select: { ownerId: true } } },
      })
      if (!product) throw new Error(`Product ${productId} not found`)

      // 2. Fetch 30-day sales history
      const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
      const salesData = await prisma.orderItem.aggregate({
        where: {
          productId,
          order: {
            status: 'DELIVERED',
            placedAt: { gte: thirtyDaysAgo },
          },
        },
        _sum: { quantity: true },
      })
      const soldLast30Days = salesData._sum.quantity ?? 0

      // 3. Generate Claude restock suggestion
      const suggestion = await generateRestockSuggestion(
        productName,
        currentStock,
        soldLast30Days
      )

      // 4. Push notification job
      const notification: NotificationJob = {
        userId: product.business.ownerId,
        title: `Low stock: ${productName}`,
        body: suggestion,
        type: currentStock === 0 ? 'out_of_stock' : 'low_stock',
        metadata: { productId, currentStock, soldLast30Days },
      }
      await notificationQueue.add('send', notification)

      logger.info(`Restock alert done for ${productName}: "${suggestion}"`)
      return { productId, suggestion }
    },
    {
      connection: redis,
      concurrency: 5,
    }
  )

  worker.on('failed', (job, err) =>
    logger.error(`Inventory worker job ${job?.id} failed`, err)
  )

  return worker
}

// ─── Claude helper ────────────────────────────────────────────────────────────

async function generateRestockSuggestion(
  productName: string,
  currentStock: number,
  soldLast30Days: number
): Promise<string> {
  const client = new Anthropic()

  const response = await client.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 250,
    messages: [
      {
        role: 'user',
        content:
          `You are a business analyst for a Philippine hyperlocal commerce platform. ` +
          `Product: "${productName}". Current stock: ${currentStock}. ` +
          `Units sold in last 30 days: ${soldLast30Days}. ` +
          `Give a concise, actionable restock recommendation in 1-2 sentences.`,
      },
    ],
  })

  const block = response.content[0]
  if (!block || block.type !== 'text') return 'Please restock this item soon.'
  return block.text
}

// ─── checkReorderAlert helper ─────────────────────────────────────────────────

/**
 * Call after any stock decrement. Queues a restock alert if stockQty <= reorderAt.
 */
export async function checkReorderAlert(productId: string): Promise<void> {
  const product = await prisma.product.findUnique({
    where: { id: productId },
    select: { id: true, name: true, stockQty: true, reorderAt: true, businessId: true },
  })

  if (!product) return
  if (product.stockQty > product.reorderAt) return

  await inventoryQueue.add(
    'restock-alert',
    {
      productId: product.id,
      businessId: product.businessId,
      currentStock: product.stockQty,
      productName: product.name,
    },
    {
      priority: product.stockQty === 0 ? 100 : 50,
      jobId: `alert-${product.id}-${Date.now()}`,
    }
  )
}
