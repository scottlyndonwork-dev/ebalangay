import { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify'
import { z } from 'zod'
import prisma from '../lib/prisma.js'
import redis from '../lib/redis.js'
import { getUser, AuthUser } from '../middleware/auth.js'

// ─── Validation schemas ───────────────────────────────────────────────────────

const availabilitySchema = z.object({
  status: z.enum(['online', 'offline']),
  barangay: z.string().min(1),
})

const registerSchema = z.object({
  gcashNumber: z.string().min(11).max(13),
  licenseImageUrl: z.string().url().optional(),
  vehicleType: z.enum(['ebike', 'etrike', 'ecar']),
})

const earningsQuerySchema = z.object({
  period: z.enum(['today', 'week', 'month']).default('today'),
})

// ─── Route handler ────────────────────────────────────────────────────────────

export async function riderRoutes(app: FastifyInstance): Promise<void> {

  /**
   * POST /riders/availability
   * Set rider online/offline and manage Redis availability sets.
   */
  app.post(
    '/availability',
    { onRequest: app.authenticate },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const user = getUser(request) as AuthUser
        if (user.role !== 'RIDER') {
          return reply.status(403).send({ success: false, error: 'Rider role required' })
        }

        const input = availabilitySchema.parse(request.body)
        const riderId = user.id

        if (input.status === 'online') {
          await redis.sadd(`online_riders:${input.barangay}`, riderId)
          await redis.setex(`rider:${riderId}:zone`, 3600, input.barangay)
          await redis.setex(`rider:${riderId}:status`, 3600, 'online')
        } else {
          const zone = await redis.get(`rider:${riderId}:zone`)
          if (zone) {
            await redis.srem(`online_riders:${zone}`, riderId)
          }
          await redis.del(
            `rider:${riderId}:zone`,
            `rider:${riderId}:status`,
            `rider:location:${riderId}`
          )
        }

        return reply.send({
          success: true,
          data: { status: input.status, barangay: input.barangay },
        })
      } catch (error) {
        if (error instanceof z.ZodError) {
          return reply.status(400).send({ success: false, error: 'Validation error', issues: error.errors })
        }
        app.log.error({ err: error }, 'Rider availability error')
        return reply.status(500).send({ success: false, error: 'Failed to update availability' })
      }
    }
  )

  /**
   * GET /riders/earnings
   * Rider's delivery earnings for the given period.
   */
  app.get(
    '/earnings',
    { onRequest: app.authenticate },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const user = getUser(request) as AuthUser
        if (user.role !== 'RIDER') {
          return reply.status(403).send({ success: false, error: 'Rider role required' })
        }

        const query = earningsQuerySchema.parse(request.query)
        const now = new Date()
        let periodStart: Date

        if (query.period === 'today') {
          periodStart = new Date(now.getFullYear(), now.getMonth(), now.getDate())
        } else if (query.period === 'week') {
          const day = now.getDay()
          periodStart = new Date(now)
          periodStart.setDate(now.getDate() - day)
          periodStart.setHours(0, 0, 0, 0)
        } else {
          periodStart = new Date(now.getFullYear(), now.getMonth(), 1)
        }

        const deliveries = await prisma.delivery.findMany({
          where: {
            riderId: user.id,
            status: 'delivered',
            deliveredAt: { gte: periodStart },
          },
          include: {
            order: {
              select: {
                id: true,
                deliveryFee: true,
                placedAt: true,
                merchant: { select: { name: true } },
              },
            },
          },
          orderBy: { deliveredAt: 'desc' },
        })

        // Rider receives RIDER_CUT (85%) of delivery fee
        const RIDER_CUT = 0.85
        const total = deliveries.reduce(
          (sum, d) => sum + Number(d.order.deliveryFee) * RIDER_CUT,
          0
        )

        return reply.send({
          success: true,
          data: {
            period: query.period,
            total: Math.round(total * 100) / 100,
            deliveryCount: deliveries.length,
            deliveries: deliveries.map((d) => ({
              deliveryId: d.id,
              orderId: d.orderId,
              merchantName: d.order.merchant.name,
              fee: Math.round(Number(d.order.deliveryFee) * RIDER_CUT * 100) / 100,
              deliveredAt: d.deliveredAt,
            })),
          },
        })
      } catch (error) {
        app.log.error({ err: error }, 'Rider earnings error')
        return reply.status(500).send({ success: false, error: 'Failed to fetch earnings' })
      }
    }
  )

  /**
   * GET /riders/active-delivery
   * Current in-progress delivery for the authenticated rider.
   */
  app.get(
    '/active-delivery',
    { onRequest: app.authenticate },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const user = getUser(request) as AuthUser
        if (user.role !== 'RIDER') {
          return reply.status(403).send({ success: false, error: 'Rider role required' })
        }

        const delivery = await prisma.delivery.findFirst({
          where: {
            riderId: user.id,
            status: { in: ['assigned', 'picked_up', 'in_transit'] },
          },
          include: {
            order: {
              include: {
                merchant: { select: { id: true, name: true } },
                items: { include: { product: { select: { name: true, price: true } } } },
              },
            },
          },
        })

        return reply.send({ success: true, data: delivery })
      } catch (error) {
        app.log.error({ err: error }, 'Active delivery error')
        return reply.status(500).send({ success: false, error: 'Failed to fetch active delivery' })
      }
    }
  )

  /**
   * POST /riders/register
   * Submit rider profile after account creation.
   */
  app.post(
    '/register',
    { onRequest: app.authenticate },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const user = getUser(request) as AuthUser
        if (user.role !== 'RIDER') {
          return reply.status(403).send({ success: false, error: 'Rider role required' })
        }

        const input = registerSchema.parse(request.body)

        const existing = await prisma.riderProfile.findUnique({ where: { userId: user.id } })
        if (existing) {
          return reply.status(409).send({ success: false, error: 'Rider profile already registered' })
        }

        const profile = await prisma.riderProfile.create({
          data: {
            userId: user.id,
            gcashNumber: input.gcashNumber,
            licenseImageUrl: input.licenseImageUrl,
            vehicleType: input.vehicleType,
          },
        })

        return reply.status(201).send({ success: true, data: profile })
      } catch (error) {
        if (error instanceof z.ZodError) {
          return reply.status(400).send({ success: false, error: 'Validation error', issues: error.errors })
        }
        app.log.error({ err: error }, 'Rider register error')
        return reply.status(500).send({ success: false, error: 'Failed to register rider profile' })
      }
    }
  )

  /**
   * GET /riders/profile
   * Get authenticated rider's profile.
   */
  app.get(
    '/profile',
    { onRequest: app.authenticate },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const user = getUser(request) as AuthUser
        if (user.role !== 'RIDER') {
          return reply.status(403).send({ success: false, error: 'Rider role required' })
        }

        const profile = await prisma.riderProfile.findUnique({ where: { userId: user.id } })
        const status = await redis.get(`rider:${user.id}:status`)
        const zone = await redis.get(`rider:${user.id}:zone`)

        return reply.send({
          success: true,
          data: { profile, onlineStatus: status ?? 'offline', zone },
        })
      } catch (error) {
        app.log.error({ err: error }, 'Rider profile error')
        return reply.status(500).send({ success: false, error: 'Failed to fetch rider profile' })
      }
    }
  )
}
