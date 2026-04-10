import { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify'
import { z } from 'zod'
import { OrderStatus as PrismaOrderStatus } from '@prisma/client'
import prisma from '../lib/prisma.js'
import { getUser, AuthUser } from '../middleware/auth.js'
import {
  OrderStatus,
  validateTransition,
  isTerminalStatus,
  getAllowedNextStatuses,
  canCancel,
} from '../lib/orderStateMachine.js'
import { checkout } from '../services/checkout.js'
import {
  dispatchQueue,
  payoutQueue,
  type DispatchJob,
  type PayoutJob,
} from '../queues/index.js'

// ─── Validation schemas ───────────────────────────────────────────────────────

const createOrderSchema = z.object({
  merchantId: z.string().uuid(),
  deliveryType: z.enum(['DELIVERY', 'PICKUP']).default('DELIVERY'),
  items: z.array(
    z.object({
      productId: z.string().uuid(),
      quantity: z.number().int().positive(),
    })
  ).min(1),
  addressLine: z.string().min(5),
  barangay: z.string().min(1),
  notes: z.string().optional(),
  dropoffLat: z.number().default(0),
  dropoffLng: z.number().default(0),
})

const updateOrderStatusSchema = z.object({
  status: z.nativeEnum(OrderStatus),
  notes: z.string().optional(),
})

const listOrdersSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  status: z.string().optional(),
  startDate: z.string().datetime({ offset: true }).optional(),
  endDate: z.string().datetime({ offset: true }).optional(),
})

type CreateOrderInput = z.infer<typeof createOrderSchema>
type UpdateStatusInput = z.infer<typeof updateOrderStatusSchema>
type ListOrdersInput = z.infer<typeof listOrdersSchema>

// ─── WebSocket broadcast helper ───────────────────────────────────────────────

function broadcastOrderUpdate(orderId: string, order: unknown): void {
  try {
    const { getIo } = require('../ws/index.js') as typeof import('../ws/index.js')
    const io = getIo()
    io.to(`merchant:${(order as any).merchantId}`).emit('order:update', {
      type: 'ORDER_STATUS_UPDATE',
      orderId,
      order,
      timestamp: new Date().toISOString(),
    })
    io.to(`customer:${(order as any).customerId}`).emit('order:update', {
      type: 'ORDER_STATUS_UPDATE',
      orderId,
      status: (order as any).status,
      timestamp: new Date().toISOString(),
    })
  } catch {
    // Socket.io not yet initialized — skip broadcast
  }
}

// ─── Route handler ────────────────────────────────────────────────────────────

export async function orderRoutes(app: FastifyInstance): Promise<void> {

  /**
   * POST /orders
   * Create a new order (checkout) with SELECT FOR UPDATE stock locking.
   */
  app.post<{ Body: CreateOrderInput }>(
    '/',
    { onRequest: app.authenticate },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const user = getUser(request) as AuthUser
        const input = createOrderSchema.parse(request.body)

        const result = await checkout({
          customerId: user.id,
          merchantId: input.merchantId,
          deliveryType: input.deliveryType,
          items: input.items,
          addressLine: input.addressLine,
          barangay: input.barangay,
          notes: input.notes,
          dropoffLat: input.dropoffLat,
          dropoffLng: input.dropoffLng,
        })

        const order = await prisma.order.findUnique({
          where: { id: result.orderId },
          include: {
            items: { include: { product: { select: { id: true, name: true, sku: true, price: true } } } },
            merchant: { select: { id: true, name: true } },
            payment: { select: { id: true, status: true, intentId: true } },
            timeline: { orderBy: { timestamp: 'desc' } },
          },
        })

        broadcastOrderUpdate(result.orderId, order)

        return reply.status(201).send({
          success: true,
          data: {
            order,
            payment: {
              checkoutUrl: result.checkoutUrl,
              intentId: result.paymentIntentId,
            },
          },
        })
      } catch (error) {
        if (error instanceof z.ZodError) {
          return reply.status(400).send({ success: false, error: 'Validation error', issues: error.errors })
        }
        const msg = error instanceof Error ? error.message : String(error)
        if (msg.includes('Insufficient stock') || msg.includes('not found') || msg.includes('not belong')) {
          return reply.status(400).send({ success: false, error: msg })
        }
        app.log.error({ err: msg }, 'Order creation error')
        return reply.status(500).send({ success: false, error: 'Failed to create order' })
      }
    }
  )

  /**
   * GET /orders
   * Customer — own orders. Merchant — business orders. Admin — all orders.
   */
  app.get<{ Querystring: ListOrdersInput }>(
    '/',
    { onRequest: app.authenticate },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const user = getUser(request) as AuthUser
        const query = listOrdersSchema.parse(request.query)

        const where: Record<string, unknown> = {}

        if (user.role === 'ADMIN') {
          // Admin sees all orders — no scoping
        } else if (user.role === 'MERCHANT') {
          const business = await prisma.business.findUnique({ where: { ownerId: user.id } })
          if (!business) {
            return reply.status(400).send({ success: false, error: 'No registered business found' })
          }
          where.merchantId = business.id
        } else {
          where.customerId = user.id
        }

        if (query.status) where.status = query.status
        if (query.startDate || query.endDate) {
          where.placedAt = {
            ...(query.startDate && { gte: new Date(query.startDate) }),
            ...(query.endDate && { lte: new Date(query.endDate) }),
          }
        }

        const [orders, total] = await Promise.all([
          prisma.order.findMany({
            where,
            include: {
              items: { include: { product: { select: { id: true, name: true, sku: true } } } },
              merchant: { select: { id: true, name: true } },
            },
            orderBy: { placedAt: 'desc' },
            skip: (query.page - 1) * query.limit,
            take: query.limit,
          }),
          prisma.order.count({ where }),
        ])

        return reply.send({
          success: true,
          data: orders,
          pagination: {
            page: query.page,
            limit: query.limit,
            total,
            pages: Math.ceil(total / query.limit),
          },
        })
      } catch (error) {
        app.log.error({ err: error }, 'Error fetching orders')
        return reply.status(500).send({ success: false, error: 'Failed to fetch orders' })
      }
    }
  )

  /**
   * GET /orders/:id
   */
  app.get(
    '/:id',
    { onRequest: app.authenticate },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const user = getUser(request) as AuthUser
        const { id } = request.params as { id: string }

        const order = await prisma.order.findUnique({
          where: { id },
          include: {
            items: { include: { product: true } },
            merchant: true,
            delivery: true,
            payment: true,
            timeline: { orderBy: { timestamp: 'desc' } },
          },
        })

        if (!order) {
          return reply.status(404).send({ success: false, error: 'Order not found' })
        }

        if (user.role === 'ADMIN') {
          // Admin has unrestricted access
        } else if (user.role === 'MERCHANT') {
          const business = await prisma.business.findUnique({ where: { ownerId: user.id } })
          if (!business || business.id !== order.merchantId) {
            return reply.status(403).send({ success: false, error: 'Access denied' })
          }
        } else if (order.customerId !== user.id) {
          return reply.status(403).send({ success: false, error: 'Access denied' })
        }

        return reply.send({ success: true, data: order })
      } catch (error) {
        app.log.error({ err: error }, 'Error fetching order')
        return reply.status(500).send({ success: false, error: 'Failed to fetch order' })
      }
    }
  )

  /**
   * PUT /orders/:id/status
   * Update order status. Merchant or Admin only, with state machine validation.
   * Triggers dispatchQueue on CONFIRMED, payoutQueue on DELIVERED.
   */
  app.put<{ Body: UpdateStatusInput }>(
    '/:id/status',
    { onRequest: app.authenticate },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const user = getUser(request) as AuthUser
        const { id } = request.params as { id: string }
        const input = updateOrderStatusSchema.parse(request.body)

        if (user.role !== 'MERCHANT' && user.role !== 'ADMIN') {
          return reply.status(403).send({ success: false, error: 'Only merchants or admins can update order status' })
        }

        const order = await prisma.order.findUnique({
          where: { id },
          include: { delivery: true },
        })

        if (!order) {
          return reply.status(404).send({ success: false, error: 'Order not found' })
        }

        if (user.role === 'MERCHANT') {
          const business = await prisma.business.findUnique({ where: { ownerId: user.id } })
          if (!business || business.id !== order.merchantId) {
            return reply.status(403).send({ success: false, error: 'Access denied' })
          }
        }

        try {
          validateTransition(order.status, input.status)
        } catch (err) {
          return reply.status(400).send({
            success: false,
            error: err instanceof Error ? err.message : 'Invalid transition',
            current: order.status,
            allowed: getAllowedNextStatuses(order.status),
          })
        }

        const updatedOrder = await prisma.order.update({
          where: { id },
          data: {
            status: input.status as unknown as PrismaOrderStatus,
            timeline: {
              create: {
                status: input.status as unknown as PrismaOrderStatus,
                timestamp: new Date(),
                notes: input.notes ?? `Status updated to ${input.status}`,
              },
            },
          },
          include: {
            items: { include: { product: { select: { id: true, name: true } } } },
            merchant: { select: { id: true, name: true } },
            delivery: true,
            timeline: { orderBy: { timestamp: 'desc' } },
          },
        })

        // Trigger dispatch when merchant confirms order
        if (input.status === OrderStatus.CONFIRMED && order.delivery) {
          const job: DispatchJob = {
            orderId: order.id,
            deliveryId: order.delivery.id,
            pickupLat: order.delivery.pickupLat,
            pickupLng: order.delivery.pickupLng,
            dropoffLat: order.delivery.dropoffLat,
            dropoffLng: order.delivery.dropoffLng,
            attempt: 1,
          }
          await dispatchQueue.add('find-rider', job, { delay: 0 })
        }

        // Trigger payout when delivery is complete
        if (input.status === OrderStatus.DELIVERED) {
          const today = new Date()
          const job: PayoutJob = {
            businessId: order.merchantId,
            periodStart: new Date(today.getFullYear(), today.getMonth(), today.getDate()).toISOString(),
            periodEnd: new Date(today.getFullYear(), today.getMonth(), today.getDate(), 23, 59, 59).toISOString(),
          }
          await payoutQueue.add('process-payout', job)
        }

        broadcastOrderUpdate(id, updatedOrder)

        return reply.send({
          success: true,
          data: updatedOrder,
          isTerminal: isTerminalStatus(input.status),
        })
      } catch (error) {
        if (error instanceof z.ZodError) {
          return reply.status(400).send({ success: false, error: 'Validation error', issues: error.errors })
        }
        app.log.error({ err: error }, 'Error updating order status')
        return reply.status(500).send({ success: false, error: 'Failed to update order status' })
      }
    }
  )

  /**
   * DELETE /orders/:id
   * Cancel order — allowed only from PLACED or CONFIRMED state.
   * Restores stock on cancellation.
   */
  app.delete(
    '/:id',
    { onRequest: app.authenticate },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const user = getUser(request) as AuthUser
        const { id } = request.params as { id: string }

        const order = await prisma.order.findUnique({
          where: { id },
          include: {
            items: { select: { productId: true, quantity: true } },
          },
        })

        if (!order) {
          return reply.status(404).send({ success: false, error: 'Order not found' })
        }

        if (user.role === 'MERCHANT') {
          const business = await prisma.business.findUnique({ where: { ownerId: user.id } })
          if (!business || business.id !== order.merchantId) {
            return reply.status(403).send({ success: false, error: 'Access denied' })
          }
        } else if (user.role !== 'ADMIN' && order.customerId !== user.id) {
          return reply.status(403).send({ success: false, error: 'Access denied' })
        }

        if (!canCancel(order.status)) {
          return reply.status(400).send({
            success: false,
            error: `Cannot cancel an order in ${order.status} state`,
          })
        }

        const cancelledOrder = await prisma.order.update({
          where: { id },
          data: {
            status: 'CANCELLED',
            timeline: {
              create: {
                status: 'CANCELLED',
                timestamp: new Date(),
                notes: `Cancelled by ${user.role.toLowerCase()}`,
              },
            },
          },
          include: {
            items: { include: { product: true } },
            merchant: { select: { id: true, name: true } },
            timeline: { orderBy: { timestamp: 'desc' } },
          },
        })

        // Restore stock
        await Promise.all(
          order.items.map((item) =>
            prisma.product.update({
              where: { id: item.productId },
              data: { stockQty: { increment: item.quantity } },
            })
          )
        )

        broadcastOrderUpdate(id, cancelledOrder)

        return reply.send({ success: true, data: cancelledOrder })
      } catch (error) {
        app.log.error({ err: error }, 'Error cancelling order')
        return reply.status(500).send({ success: false, error: 'Failed to cancel order' })
      }
    }
  )
}
