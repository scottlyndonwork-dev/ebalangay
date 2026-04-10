import { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify'
import prisma from '../lib/prisma.js'
import redis from '../lib/redis.js'
import { getUser, AuthUser } from '../middleware/auth.js'
import { uploadToR2, ALLOWED_IMAGE_TYPES, MAX_IMAGE_SIZE } from '../lib/storage.js'
import { validateTransition } from '../lib/orderStateMachine.js'
import { payoutQueue } from '../queues/index.js'
import type { PayoutJob } from '../queues/index.js'
import { OrderStatus as PrismaOrderStatus } from '@prisma/client'

export async function deliveryRoutes(app: FastifyInstance): Promise<void> {

  /**
   * GET /deliveries/:id
   * Delivery details. Accessible by the assigned rider, merchant, customer, or admin.
   */
  app.get(
    '/:id',
    { onRequest: app.authenticate },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const user = getUser(request) as AuthUser
        const { id } = request.params as { id: string }

        const delivery = await prisma.delivery.findUnique({
          where: { id },
          include: {
            order: {
              include: {
                merchant: { select: { id: true, name: true } },
                customer: { select: { id: true, name: true, phone: true } },
                items: { include: { product: { select: { name: true, price: true } } } },
              },
            },
            rider: { select: { id: true, name: true, phone: true } },
          },
        })

        if (!delivery) {
          return reply.status(404).send({ success: false, error: 'Delivery not found' })
        }

        // Authorization: rider, merchant, customer, or admin
        const isRider = delivery.riderId === user.id
        const isMerchant = user.role === 'MERCHANT' // further check below
        const isCustomer = delivery.order.customer.id === user.id
        const isAdmin = user.role === 'ADMIN'

        if (!isRider && !isCustomer && !isAdmin) {
          if (isMerchant) {
            const business = await prisma.business.findUnique({ where: { ownerId: user.id } })
            if (!business || business.id !== delivery.order.merchant.id) {
              return reply.status(403).send({ success: false, error: 'Access denied' })
            }
          } else {
            return reply.status(403).send({ success: false, error: 'Access denied' })
          }
        }

        return reply.send({ success: true, data: delivery })
      } catch (error) {
        app.log.error({ err: error }, 'Get delivery error')
        return reply.status(500).send({ success: false, error: 'Failed to fetch delivery' })
      }
    }
  )

  /**
   * POST /deliveries/:id/pickup
   * Rider confirms they picked up the order from the merchant.
   * Transitions order: READY_FOR_PICKUP → PICKED_UP → IN_TRANSIT
   */
  app.post(
    '/:id/pickup',
    { onRequest: app.authenticate },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const user = getUser(request) as AuthUser
        if (user.role !== 'RIDER') {
          return reply.status(403).send({ success: false, error: 'Rider role required' })
        }

        const { id } = request.params as { id: string }

        const delivery = await prisma.delivery.findUnique({
          where: { id },
          include: { order: { select: { id: true, status: true, customerId: true, merchantId: true } } },
        })

        if (!delivery) {
          return reply.status(404).send({ success: false, error: 'Delivery not found' })
        }
        if (delivery.riderId !== user.id) {
          return reply.status(403).send({ success: false, error: 'Not your delivery' })
        }
        if (delivery.status !== 'assigned') {
          return reply.status(400).send({ success: false, error: `Cannot pick up a delivery in '${delivery.status}' state` })
        }

        // Validate order state transitions: READY_FOR_PICKUP → PICKED_UP → IN_TRANSIT
        try {
          validateTransition(delivery.order.status, 'PICKED_UP')
        } catch (err) {
          return reply.status(400).send({ success: false, error: err instanceof Error ? err.message : 'Invalid order state' })
        }

        // Update delivery + order (chain both transitions atomically)
        const now = new Date()
        await prisma.$transaction(async (tx) => {
          await tx.delivery.update({ where: { id }, data: { status: 'picked_up' } })

          await tx.order.update({
            where: { id: delivery.order.id },
            data: {
              status: 'PICKED_UP' as PrismaOrderStatus,
              timeline: {
                create: { status: 'PICKED_UP' as PrismaOrderStatus, timestamp: now, notes: 'Rider picked up order' },
              },
            },
          })
        })

        // Immediately chain PICKED_UP → IN_TRANSIT
        await prisma.$transaction(async (tx) => {
          await tx.delivery.update({ where: { id }, data: { status: 'in_transit' } })
          await tx.order.update({
            where: { id: delivery.order.id },
            data: {
              status: 'IN_TRANSIT' as PrismaOrderStatus,
              timeline: {
                create: { status: 'IN_TRANSIT' as PrismaOrderStatus, timestamp: now, notes: 'Rider in transit' },
              },
            },
          })
        })

        // Broadcast to all parties
        try {
          const { getIo } = await import('../ws/index.js')
          const io = getIo()
          const payload = { type: 'ORDER_PICKED_UP', deliveryId: id, orderId: delivery.order.id, timestamp: now.toISOString() }
          io.to(`customer:${delivery.order.customerId}`).emit('order:update', payload)
          io.to(`merchant:${delivery.order.merchantId}`).emit('order:update', payload)
        } catch {}

        return reply.send({ success: true, data: { deliveryId: id, status: 'in_transit' } })
      } catch (error) {
        app.log.error({ err: error }, 'Delivery pickup error')
        return reply.status(500).send({ success: false, error: 'Failed to mark pickup' })
      }
    }
  )

  /**
   * POST /deliveries/:id/complete
   * Rider uploads proof photo (required) + optional signature, marks delivered.
   * Transitions order: IN_TRANSIT → DELIVERED.
   */
  app.post(
    '/:id/complete',
    { onRequest: app.authenticate },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const user = getUser(request) as AuthUser
        if (user.role !== 'RIDER') {
          return reply.status(403).send({ success: false, error: 'Rider role required' })
        }

        const { id } = request.params as { id: string }

        const delivery = await prisma.delivery.findUnique({
          where: { id },
          include: {
            order: {
              select: {
                id: true,
                status: true,
                merchantId: true,
                customerId: true,
                deliveryFee: true,
              },
            },
          },
        })

        if (!delivery) {
          return reply.status(404).send({ success: false, error: 'Delivery not found' })
        }
        if (delivery.riderId !== user.id) {
          return reply.status(403).send({ success: false, error: 'Not your delivery' })
        }
        if (delivery.status !== 'in_transit') {
          return reply.status(400).send({ success: false, error: `Cannot complete a delivery in '${delivery.status}' state` })
        }

        // Validate order transition
        try {
          validateTransition(delivery.order.status, 'DELIVERED')
        } catch (err) {
          return reply.status(400).send({ success: false, error: err instanceof Error ? err.message : 'Invalid order state' })
        }

        // Parse multipart form
        const parts = request.parts()
        let proofBuffer: Buffer | null = null
        let signatureBuffer: Buffer | null = null
        let proofContentType = 'image/jpeg'
        let sigContentType = 'image/jpeg'

        for await (const part of parts) {
          if (part.type === 'file') {
            const chunks: Buffer[] = []
            for await (const chunk of part.file) {
              chunks.push(chunk as Buffer)
            }
            const buf = Buffer.concat(chunks)

            if (buf.length > MAX_IMAGE_SIZE) {
              return reply.status(400).send({ success: false, error: `File '${part.fieldname}' exceeds 5MB limit` })
            }
            if (!ALLOWED_IMAGE_TYPES.includes(part.mimetype)) {
              return reply.status(400).send({ success: false, error: `File '${part.fieldname}' has unsupported type` })
            }

            if (part.fieldname === 'proofPhoto') {
              proofBuffer = buf
              proofContentType = part.mimetype
            } else if (part.fieldname === 'signaturePhoto') {
              signatureBuffer = buf
              sigContentType = part.mimetype
            }
          }
        }

        if (!proofBuffer) {
          return reply.status(400).send({ success: false, error: 'proofPhoto is required' })
        }

        // Upload photos to R2
        const [proofUrl, signatureUrl] = await Promise.all([
          uploadToR2(proofBuffer, `deliveries/${id}/proof.jpg`, proofContentType),
          signatureBuffer
            ? uploadToR2(signatureBuffer, `deliveries/${id}/signature.jpg`, sigContentType)
            : Promise.resolve(null),
        ])

        const now = new Date()

        // Update delivery + order
        await prisma.$transaction(async (tx) => {
          await tx.delivery.update({
            where: { id },
            data: {
              status: 'delivered',
              proofPhotoUrl: proofUrl,
              signaturePhotoUrl: signatureUrl,
              deliveredAt: now,
            },
          })

          await tx.order.update({
            where: { id: delivery.order.id },
            data: {
              status: 'DELIVERED' as PrismaOrderStatus,
              timeline: {
                create: {
                  status: 'DELIVERED' as PrismaOrderStatus,
                  timestamp: now,
                  notes: 'Delivered and proof uploaded',
                },
              },
            },
          })
        })

        // Queue payout
        const today = new Date()
        const payoutJob: PayoutJob = {
          businessId: delivery.order.merchantId,
          periodStart: new Date(today.getFullYear(), today.getMonth(), today.getDate()).toISOString(),
          periodEnd: new Date(today.getFullYear(), today.getMonth(), today.getDate(), 23, 59, 59).toISOString(),
        }
        await payoutQueue.add('process-payout', payoutJob)

        // Re-add rider to online set (mark available again)
        const zone = await redis.get(`rider:${user.id}:zone`)
        if (zone) {
          await redis.sadd(`online_riders:${zone}`, user.id)
        }

        // Broadcast
        try {
          const { getIo } = await import('../ws/index.js')
          const io = getIo()
          const payload = {
            type: 'ORDER_DELIVERED',
            deliveryId: id,
            orderId: delivery.order.id,
            proofPhotoUrl: proofUrl,
            timestamp: now.toISOString(),
          }
          io.to(`customer:${delivery.order.customerId}`).emit('order:update', payload)
          io.to(`merchant:${delivery.order.merchantId}`).emit('order:update', payload)
          io.to('admin').emit('delivery:completed', payload)
        } catch {}

        return reply.send({
          success: true,
          data: { deliveryId: id, status: 'delivered', proofPhotoUrl: proofUrl, signaturePhotoUrl: signatureUrl },
        })
      } catch (error) {
        app.log.error({ err: error }, 'Delivery complete error')
        return reply.status(500).send({ success: false, error: 'Failed to complete delivery' })
      }
    }
  )
}
