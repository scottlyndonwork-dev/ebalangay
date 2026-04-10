import { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify'
import prisma from '../lib/prisma.js'
import redis from '../lib/redis.js'
import { getUser, AuthUser } from '../middleware/auth.js'

export async function analyticsRoutes(app: FastifyInstance): Promise<void> {

  /**
   * GET /analytics/live-deliveries
   * Admin dashboard: all in-progress deliveries with real-time rider GPS.
   * Intended to be polled every ~15 seconds.
   */
  app.get(
    '/live-deliveries',
    { onRequest: app.authenticate },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const user = getUser(request) as AuthUser
        if (user.role !== 'ADMIN') {
          return reply.status(403).send({ success: false, error: 'Admin role required' })
        }

        const deliveries = await prisma.delivery.findMany({
          where: { status: { in: ['assigned', 'picked_up', 'in_transit'] } },
          include: {
            order: { select: { id: true, customerId: true, merchantId: true } },
            rider: { select: { id: true, name: true } },
          },
        })

        const result = await Promise.all(
          deliveries.map(async (d) => {
            let riderLat: number | null = null
            let riderLng: number | null = null

            if (d.riderId) {
              const locStr = await redis.get(`rider:location:${d.riderId}`)
              if (locStr) {
                const loc = JSON.parse(locStr) as { lat: number; lng: number }
                riderLat = loc.lat
                riderLng = loc.lng
              }
            }

            return {
              deliveryId: d.id,
              orderId: d.orderId,
              riderName: d.rider?.name ?? null,
              riderId: d.riderId,
              riderLat,
              riderLng,
              dropoffLat: d.dropoffLat,
              dropoffLng: d.dropoffLng,
              status: d.status,
            }
          })
        )

        return reply.send({ success: true, data: result, timestamp: new Date().toISOString() })
      } catch (error) {
        app.log.error({ err: error }, 'Live deliveries error')
        return reply.status(500).send({ success: false, error: 'Failed to fetch live deliveries' })
      }
    }
  )
}
