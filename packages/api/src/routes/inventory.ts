import { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify'
import { Queue } from 'bullmq'
import prisma from '../lib/prisma.js'
import redis from '../lib/redis.js'
import {
  getQueueStats,
  getQueueJobs,
  retryFailedJob,
  removeJob,
  clearQueue,
  triggerRestockAlertManual,
  getRestockAlertHistory,
  getLowStockProducts,
} from '../queues/utils.js'
import { getUser, requireMerchant, requireAdmin, AuthUser } from '../middleware/auth.js'
import type { RestockAlertJob } from '../queues/index.js'

/**
 * Register inventory management routes
 * Protection: Merchant endpoints require MERCHANT role, Admin endpoints require ADMIN role
 */
export async function inventoryRoutes(app: FastifyInstance) {

  /**
   * GET /inventory/queue/status
   * Get status of all inventory-related queues
   */
  app.get(
    '/queue/status',
    {
      onRequest: [app.authenticate, requireAdmin],
      schema: {
        description: 'Get status of inventory queues',
        tags: ['Inventory Management'],
        response: {
          200: {
            type: 'object',
            properties: {
              status: { type: 'string' },
              queues: { type: 'array' },
            },
          },
        },
      },
    },
    async (_request: FastifyRequest, reply: FastifyReply) => {
      try {
        const inventoryQueue = new Queue<RestockAlertJob>('inventory', {
          connection: redis,
        })
        const suggestionsQueue = new Queue('suggestions', {
          connection: redis,
        })
        const notificationsQueue = new Queue('notifications', {
          connection: redis,
        })

        const stats = await Promise.all([
          getQueueStats(inventoryQueue),
          getQueueStats(suggestionsQueue),
          getQueueStats(notificationsQueue),
        ])

        return reply.status(200).send({
          status: 'ok',
          queues: stats,
          timestamp: new Date().toISOString(),
        })
      } catch (error) {
        app.log.error({ err: error }, 'Queue status error')
        return reply.status(500).send({
          error: 'Internal Server Error',
          message: error instanceof Error ? error.message : 'Unknown error',
        })
      }
    }
  )

  /**
   * GET /inventory/queue/:queueName/jobs
   * Get jobs from a specific queue (status: all, completed, failed, active, waiting, delayed)
   */
  app.get<{ Params: { queueName: string; status?: string } }>(
    '/queue/:queueName/jobs',
    {
      onRequest: [app.authenticate, requireAdmin],
      schema: {
        description: 'Get jobs from a queue',
        tags: ['Inventory Management'],
        params: {
          type: 'object',
          required: ['queueName'],
          properties: {
            queueName: {
              type: 'string',
              enum: ['inventory', 'suggestions', 'notifications'],
            },
          },
        },
        querystring: {
          type: 'object',
          properties: {
            status: {
              type: 'string',
              enum: ['all', 'completed', 'failed', 'active', 'waiting', 'delayed'],
            },
          },
        },
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const { queueName } = request.params as { queueName: string }
        const { status } = request.query as { status?: string }

        const queue = new Queue(queueName, { connection: redis })
        const jobs = await getQueueJobs(queue, status || 'all')

        return reply.status(200).send({
          queueName,
          status: status || 'all',
          count: jobs.length,
          jobs,
        })
      } catch (error) {
        app.log.error({ err: error }, 'Get queue jobs error')
        return reply.status(500).send({
          error: 'Internal Server Error',
          message: error instanceof Error ? error.message : 'Unknown error',
        })
      }
    }
  )

  /**
   * POST /inventory/queue/:queueName/retry/:jobId
   * Retry a failed job
   */
  app.post<{ Params: { queueName: string; jobId: string } }>(
    '/queue/:queueName/retry/:jobId',
    {
      onRequest: [app.authenticate, requireAdmin],
      schema: {
        description: 'Retry a failed job',
        tags: ['Inventory Management'],
        params: {
          type: 'object',
          required: ['queueName', 'jobId'],
          properties: {
            queueName: { type: 'string' },
            jobId: { type: 'string' },
          },
        },
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const { queueName, jobId } = request.params as {
          queueName: string
          jobId: string
        }

        const queue = new Queue(queueName, { connection: redis })
        const result = await retryFailedJob(queue, jobId)

        return reply.status(result.success ? 200 : 400).send(result)
      } catch (error) {
        app.log.error({ err: error }, 'Retry job error')
        return reply.status(500).send({
          error: 'Internal Server Error',
          message: error instanceof Error ? error.message : 'Unknown error',
        })
      }
    }
  )

  /**
   * DELETE /inventory/queue/:queueName/job/:jobId
   * Remove a job from queue
   */
  app.delete<{ Params: { queueName: string; jobId: string } }>(
    '/queue/:queueName/job/:jobId',
    {
      onRequest: [app.authenticate, requireAdmin],
      schema: {
        description: 'Remove a job from queue',
        tags: ['Inventory Management'],
        params: {
          type: 'object',
          required: ['queueName', 'jobId'],
          properties: {
            queueName: { type: 'string' },
            jobId: { type: 'string' },
          },
        },
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const { queueName, jobId } = request.params as {
          queueName: string
          jobId: string
        }

        const queue = new Queue(queueName, { connection: redis })
        const result = await removeJob(queue, jobId)

        return reply.status(result.success ? 200 : 400).send(result)
      } catch (error) {
        app.log.error({ err: error }, 'Remove job error')
        return reply.status(500).send({
          error: 'Internal Server Error',
          message: error instanceof Error ? error.message : 'Unknown error',
        })
      }
    }
  )

  /**
   * DELETE /inventory/queue/:queueName/clear
   * Clear all jobs from a queue
   */
  app.delete<{ Params: { queueName: string } }>(
    '/queue/:queueName/clear',
    {
      onRequest: [app.authenticate, requireAdmin],
      schema: {
        description: 'Clear all jobs from a queue',
        tags: ['Inventory Management'],
        params: {
          type: 'object',
          required: ['queueName'],
          properties: {
            queueName: { type: 'string' },
          },
        },
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const { queueName } = request.params as { queueName: string }

        const queue = new Queue(queueName, { connection: redis })
        const result = await clearQueue(queue)

        return reply.status(result.success ? 200 : 400).send(result)
      } catch (error) {
        app.log.error({ err: error }, 'Clear queue error')
        return reply.status(500).send({
          error: 'Internal Server Error',
          message: error instanceof Error ? error.message : 'Unknown error',
        })
      }
    }
  )

  /**
   * GET /inventory/low-stock
   * Get all low stock products for merchant
   */
  app.get(
    '/low-stock',
    {
      onRequest: [app.authenticate, requireMerchant],
      schema: {
        description: 'Get low stock products for your business',
        tags: ['Inventory Management'],
        response: {
          200: {
            type: 'object',
            properties: {
              success: { type: 'boolean' },
              total: { type: 'integer' },
              lowStockCount: { type: 'integer' },
              products: { type: 'array' },
            },
          },
        },
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const user = getUser(request) as AuthUser

        // Get business for this merchant
        const business = await prisma.business.findUnique({
          where: { ownerId: user.id },
        })

        if (!business) {
          return reply.status(404).send({
            error: 'Not Found',
            message: 'No business found for this user',
          })
        }

        const result = await getLowStockProducts(prisma, business.id)
        return reply.status(200).send(result)
      } catch (error) {
        app.log.error({ err: error }, 'Get low stock error')
        return reply.status(500).send({
          error: 'Internal Server Error',
          message: error instanceof Error ? error.message : 'Unknown error',
        })
      }
    }
  )

  /**
   * GET /inventory/alerts/history
   * Get restock alert history for merchant
   */
  app.get(
    '/alerts/history',
    {
      onRequest: [app.authenticate, requireMerchant],
      schema: {
        description: 'Get restock alert history',
        tags: ['Inventory Management'],
        querystring: {
          type: 'object',
          properties: {
            limit: {
              type: 'integer',
              minimum: 1,
              maximum: 100,
              default: 20,
            },
          },
        },
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const user = getUser(request) as AuthUser
        const { limit } = request.query as { limit?: number }

        // Get business for this merchant
        const business = await prisma.business.findUnique({
          where: { ownerId: user.id },
        })

        if (!business) {
          return reply.status(404).send({
            error: 'Not Found',
            message: 'No business found for this user',
          })
        }

        const result = await getRestockAlertHistory(prisma, business.id, limit || 20)
        return reply.status(200).send(result)
      } catch (error) {
        app.log.error({ err: error }, 'Get alert history error')
        return reply.status(500).send({
          error: 'Internal Server Error',
          message: error instanceof Error ? error.message : 'Unknown error',
        })
      }
    }
  )

  /**
   * POST /inventory/alerts/test
   * Manually trigger a restock alert (for testing)
   */
  app.post<{ Body: { productId: string } }>(
    '/alerts/test',
    {
      onRequest: [app.authenticate, requireMerchant],
      schema: {
        description: 'Manually trigger a restock alert for testing',
        tags: ['Inventory Management'],
        body: {
          type: 'object',
          required: ['productId'],
          properties: {
            productId: { type: 'string' },
          },
        },
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const user = getUser(request) as AuthUser
        const { productId } = request.body as { productId: string }

        // Verify product ownership
        const product = await prisma.product.findUnique({
          where: { id: productId },
          include: {
            business: {
              select: { ownerId: true },
            },
          },
        })

        if (!product) {
          return reply.status(404).send({
            error: 'Not Found',
            message: 'Product not found',
          })
        }

        if (product.business.ownerId !== user.id) {
          return reply.status(403).send({
            error: 'Forbidden',
            message: 'You can only test alerts for your own products',
          })
        }

        const inventoryQueue = new Queue<RestockAlertJob>('inventory', {
          connection: redis,
        })

        const result = await triggerRestockAlertManual(
          inventoryQueue,
          productId,
          product.businessId,
          product.stockQty,
          product.name
        )

        return reply.status(result.success ? 200 : 400).send(result)
      } catch (error) {
        app.log.error({ err: error }, 'Test alert error')
        return reply.status(500).send({
          error: 'Internal Server Error',
          message: error instanceof Error ? error.message : 'Unknown error',
        })
      }
    }
  )

  app.log.info('✅ Inventory management routes registered')
}
