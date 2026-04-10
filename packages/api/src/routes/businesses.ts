import { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify'
import { z } from 'zod'
import { getUser, requireMerchant, AuthUser } from '../middleware/auth.js'
import prisma from '../lib/prisma.js'

const createBusinessSchema = z.object({
  name: z.string().min(1),
  type: z.enum(['RETAIL', 'RESTAURANT', 'PHARMACY', 'HARDWARE', 'WHOLESALE', 'DISTRIBUTOR']),
  barangay: z.string().min(1),
  city: z.string().min(1),
  logoUrl: z.string().optional(),
})

type CreateBusinessInput = z.infer<typeof createBusinessSchema>

export async function businessRoutes(app: FastifyInstance): Promise<void> {

  /**
   * POST /businesses
   * Create a new business (merchants only)
   */
  app.post<{ Body: CreateBusinessInput }>(
    '/',
    {
      onRequest: [app.authenticate, requireMerchant],
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const user = getUser(request) as AuthUser
        const input = createBusinessSchema.parse(request.body)

        // Check if merchant already has a business
        const existingBusiness = await prisma.business.findUnique({
          where: { ownerId: user.id },
        })

        if (existingBusiness) {
          return reply.status(400).send({
            error: 'Business Already Exists',
            message: 'You already have a registered business',
          })
        }

        const business = await prisma.business.create({
          data: {
            ...input,
            ownerId: user.id,
          },
        })

        return reply.status(201).send({
          data: business,
          message: 'Business created successfully',
        })
      } catch (error) {
        if (error instanceof z.ZodError) {
          return reply.status(400).send({
            error: 'Validation Error',
            issues: error.errors,
          })
        }

        app.log.error({ err: error }, 'Business creation error')
        return reply.status(500).send({
          error: 'Internal Server Error',
          message: 'Failed to create business',
        })
      }
    }
  )

  /**
   * GET /businesses/me
   * Get current merchant's business
   */
  app.get(
    '/me',
    {
      onRequest: [app.authenticate, requireMerchant],
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const user = getUser(request) as AuthUser

        const business = await prisma.business.findUnique({
          where: { ownerId: user.id },
          include: {
            _count: {
              select: { products: true, orders: true },
            },
          },
        })

        if (!business) {
          return reply.status(404).send({
            error: 'Business Not Found',
            message: 'You do not have a registered business yet',
          })
        }

        return reply.send({
          data: business,
        })
      } catch (error) {
        app.log.error({ err: error }, 'Error fetching business')
        return reply.status(500).send({
          error: 'Internal Server Error',
          message: 'Failed to fetch business',
        })
      }
    }
  )
}
