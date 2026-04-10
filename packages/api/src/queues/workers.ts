import { Worker, Job } from 'bullmq'
import { PrismaClient } from '@prisma/client'
import { Redis } from 'ioredis'
import Anthropic from '@anthropic-ai/sdk'
import type { RestockAlertJob, NotificationJob } from './index.js'

/**
 * Setup inventory alert worker - triggered when stock drops below reorderAt
 */
export function setupInventoryAlertWorker(
  redisConnection: Redis,
  prisma: PrismaClient,
  logger: any
) {
  const worker = new Worker<RestockAlertJob>(
    'inventory',
    async (job: Job<RestockAlertJob>) => {
      try {
        logger.info(
          `🔔 Processing restock alert for product ${job.data.productId}`
        )

        // Fetch product details
        const product = await prisma.product.findUnique({
          where: { id: job.data.productId },
          include: {
            business: {
              include: {
                owner: {
                  select: {
                    id: true,
                    phone: true,
                    email: true,
                    pushTokens: true,
                  },
                },
              },
            },
          },
        })

        if (!product) {
          throw new Error(`Product ${job.data.productId} not found`)
        }

        // Make sure stock is still low
        if (product.stockQty > product.reorderAt) {
          logger.info(
            `⚠️  Stock alert skipped - stock level recovered (${product.stockQty} > ${product.reorderAt})`
          )
          return { status: 'skipped', reason: 'stock_recovered' }
        }

        // Determine alert severity
        const severity =
          product.stockQty === 0
            ? 'out_of_stock'
            : product.stockQty <= Math.floor(product.reorderAt * 0.25)
              ? 'critical'
              : 'low'

        logger.info(`📊 Stock severity: ${severity}`)

        // Create restock suggestion via AI
        const suggestion = await generateRestockSuggestion(
          product,
          job.data.currentStock,
          severity
        )

        logger.info(`💡 Generated suggestion: ${suggestion.substring(0, 50)}...`)

        // Queue push notification
        if (
          product.business.owner &&
          product.business.owner.pushTokens &&
          product.business.owner.pushTokens.length > 0
        ) {
          const notificationData: NotificationJob = {
            userId: product.business.ownerId,
            title:
              severity === 'out_of_stock'
                ? `❌ ${product.name} is out of stock!`
                : severity === 'critical'
                  ? `🚨 Critical: ${product.name} running out!`
                  : `⚠️  Low stock: ${product.name}`,
            body: suggestion,
            type: severity === 'out_of_stock' ? 'out_of_stock' : 'low_stock',
            metadata: {
              productId: product.id,
              currentStock: product.stockQty,
              sku: product.sku ?? undefined,
              severity,
            },
          }

          const { Queue } = await import('bullmq')
          const notificationsQueue = new Queue<NotificationJob>('notification', {
            connection: redisConnection,
          })
          await notificationsQueue.add('send', notificationData, {
            priority: severity === 'out_of_stock' ? 100 : 50,
          })
        }

        // Record alert in database for audit trail
        await prisma.inventoryAlert.create({
          data: {
            productId: product.id,
            businessId: job.data.businessId,
            currentStock: product.stockQty,
            reorderAt: product.reorderAt,
            severity,
            suggestion,
            status: 'sent',
          },
        })

        logger.info(`✅ Restock alert processed successfully`)

        return {
          status: 'success',
          productId: product.id,
          severity,
          notificationQueued: true,
          suggestion,
        }
      } catch (error) {
        logger.error(
          `❌ Error processing inventory alert:`,
          error instanceof Error ? error.message : 'Unknown error'
        )
        throw error
      }
    },
    {
      connection: redisConnection,
      concurrency: 5,
      maxStalledCount: 3,
      stalledInterval: 30000,
      lockDuration: 30000,
    }
  )

  worker.on('completed', (job) => {
    logger.info(`🎉 Inventory alert job ${job.id} completed`)
  })

  worker.on('failed', (job, err) => {
    logger.error(
      `💥 Inventory alert job ${job?.id} failed:`,
      err.message
    )
  })

  return worker
}

/**
 * Setup push notification worker - sends notifications to merchants
 */
export function setupNotificationWorker(
  redisConnection: Redis,
  prisma: PrismaClient,
  logger: any
) {
  const worker = new Worker<NotificationJob>(
    'notifications',
    async (job: Job<NotificationJob>) => {
      try {
        logger.info(
          `📤 Sending ${job.data.type} notification to user ${job.data.userId}`
        )

        // Fetch user with push tokens
        const user = await prisma.user.findUnique({
          where: { id: job.data.userId },
          select: {
            id: true,
            phone: true,
            pushTokens: true,
          },
        })

        if (!user || !user.pushTokens || user.pushTokens.length === 0) {
          logger.warn(`⚠️  No push tokens found for user ${job.data.userId}`)
          return { status: 'skipped', reason: 'no_push_tokens' }
        }

        // Simulate push notification (in production, use Firebase, OneSignal, etc.)
        const results = user.pushTokens.map((token: string) => {
          // TODO: Integrate with actual push notification service
          // Example:
          // await sendPushNotificationViaFirebase(token, {
          //   title: job.data.title,
          //   body: job.data.body,
          //   data: job.data.metadata
          // })

          logger.info(`✉️  Mock push sent to token: ${token.substring(0, 20)}...`)
          return {
            token,
            success: true,
            timestamp: new Date().toISOString(),
          }
        })

        // Log notification in database
        await prisma.notification.create({
          data: {
            userId: job.data.userId,
            type: job.data.type,
            title: job.data.title,
            body: job.data.body,
            metadata: (job.data.metadata ?? null) as any,
            status: 'sent',
            sentAt: new Date(),
          },
        })

        logger.info(
          `✅ Notification sent to ${results.length} token(s)`
        )

        return {
          status: 'success',
          tokensNotified: results.length,
          results,
        }
      } catch (error) {
        logger.error(
          `❌ Error sending notification:`,
          error instanceof Error ? error.message : 'Unknown error'
        )
        throw error
      }
    },
    {
      connection: redisConnection,
      concurrency: 10,
      maxStalledCount: 2,
      stalledInterval: 15000,
      lockDuration: 15000,
    }
  )

  worker.on('completed', (job) => {
    logger.info(`✉️  Notification job ${job.id} completed`)
  })

  worker.on('failed', (job, err) => {
    logger.error(
      `💥 Notification job ${job?.id} failed:`,
      err.message
    )
  })

  return worker
}

/**
 * Generate AI-powered restock suggestion using Anthropic
 */
async function generateRestockSuggestion(
  product: any,
  currentStock: number,
  severity: 'critical' | 'low' | 'out_of_stock'
): Promise<string> {
  const client = new Anthropic()

  const prompt =
    severity === 'out_of_stock'
      ? `You are a business analytics assistant. The product "${product.name}" (SKU: ${product.sku}) is completely out of stock. This is an urgent situation for the merchant. Provide a brief, actionable suggestion for immediate restocking. Keep it under 80 characters.`
      : severity === 'critical'
        ? `You are a business analytics assistant. The product "${product.name}" (SKU: ${product.sku}) has only ${currentStock} units left (reorder point: ${product.reorderAt}). Stock is critically low. Suggest an urgent action. Keep it under 80 characters.`
        : `You are a business analytics assistant. The product "${product.name}" (SKU: ${product.sku}) has ${currentStock} units left (reorder point: ${product.reorderAt}). Suggest a restocking action. Keep it under 80 characters.`

  const message = await client.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 100,
    messages: [
      {
        role: 'user',
        content: prompt,
      },
    ],
  })

  const block = message.content[0]
  const suggestion =
    block && block.type === 'text'
      ? block.text
      : 'Please restock this item soon.'

  return suggestion.substring(0, 120) // Ensure it fits in notifications
}

/**
 * Trigger restock alert check after stock adjustment
 * Call this after every order or stock adjustment
 */
export async function checkAndQueueRestockAlert(
  productId: string,
  redisConnection: Redis,
  prisma: PrismaClient,
  logger?: any
) {
  try {
    // Fetch current product stock
    const product = await prisma.product.findUnique({
      where: { id: productId },
      select: {
        id: true,
        stockQty: true,
        reorderAt: true,
        businessId: true,
        name: true,
      },
    })

    if (!product) {
      logger?.warn(`Product ${productId} not found for restock check`)
      return
    }

    // Only trigger alert if stock dropped below or equal to reorderAt
    if (product.stockQty <= product.reorderAt) {
      const { Queue } = await import('bullmq')
      const inventoryQueue = new Queue<RestockAlertJob>('inventory', {
        connection: redisConnection,
      })

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
          delay: 0,
          jobId: `alert-${product.id}-${Date.now()}`,
        }
      )

      logger?.info(
        `📌 Restock alert queued for product ${product.id} (stock: ${product.stockQty})`
      )

      return true
    }

    return false
  } catch (error) {
    logger?.error(
      'Error checking restock alert:',
      error instanceof Error ? error.message : 'Unknown error'
    )
    return false
  }
}

/**
 * Initialize all inventory workers
 */
export async function initializeInventoryWorkers(
  redisConnection: Redis,
  prisma: PrismaClient,
  logger: any
) {
  logger.info('🚀 Initializing inventory workers...')

  const inventoryWorker = setupInventoryAlertWorker(
    redisConnection,
    prisma,
    logger
  )
  const notificationWorker = setupNotificationWorker(
    redisConnection,
    prisma,
    logger
  )

  logger.info('✅ All inventory workers initialized')

  return {
    inventoryWorker,
    notificationWorker,
  }
}
