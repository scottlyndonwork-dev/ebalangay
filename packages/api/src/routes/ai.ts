import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import prisma from '../lib/prisma.js'
import {
  generateRestockSuggestion,
  generateProductDescription,
  streamCustomerSupport,
} from '../services/ai.js'

// ─── Schemas ──────────────────────────────────────────────────────────────────

const productDescriptionSchema = z.object({
  name: z.string().min(1).max(120),
  category: z.string().min(1),
  price: z.number().positive(),
})

const chatSchema = z.object({
  messages: z
    .array(
      z.object({
        role: z.enum(['user', 'assistant']),
        content: z.string().min(1).max(2000),
      })
    )
    .min(1)
    .max(20),
  orderContext: z.string().max(1000).optional(),
})

// ─── Routes ───────────────────────────────────────────────────────────────────

export async function aiRoutes(app: FastifyInstance): Promise<void> {
  // POST /ai/product-description — merchant only
  app.post(
    '/product-description',
    { preHandler: [app.authenticate, app.requireRole(['MERCHANT'])] },
    async (request, reply) => {
      const parsed = productDescriptionSchema.safeParse(request.body)
      if (!parsed.success) {
        return reply
          .status(400)
          .send({ success: false, error: parsed.error.issues[0]?.message ?? 'Invalid input' })
      }

      const { name, category, price } = parsed.data
      const description = await generateProductDescription(name, category, price)
      return reply.send({ success: true, data: { description } })
    }
  )

  // GET /ai/restock-suggestions — merchant only
  app.get(
    '/restock-suggestions',
    { preHandler: [app.authenticate, app.requireRole(['MERCHANT'])] },
    async (request, reply) => {
      const user = request.user as { id: string }

      const business = await prisma.business.findUnique({
        where: { ownerId: user.id },
        select: { id: true },
      })

      if (!business) {
        return reply.status(404).send({ success: false, error: 'Business not found' })
      }

      // Find products at or below their own reorderAt threshold via raw query
      const products = await prisma.$queryRaw<
        Array<{
          id: string
          name: string
          category: string
          stockQty: number
          reorderAt: number
        }>
      >`
        SELECT id, name, category, "stockQty", "reorderAt"
        FROM products
        WHERE "businessId" = ${business.id}
          AND "isActive" = true
          AND "stockQty" <= "reorderAt"
      `

      const suggestions = await Promise.all(
        products.map(async (p) => {
          // Compute sales data from order history
          const thirtyDaysAgo = new Date()
          thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)
          const sevenDaysAgo = new Date()
          sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)

          const [sold30, sold7] = await Promise.all([
            prisma.orderItem.aggregate({
              where: {
                productId: p.id,
                order: { placedAt: { gte: thirtyDaysAgo }, status: 'DELIVERED' },
              },
              _sum: { quantity: true },
            }),
            prisma.orderItem.aggregate({
              where: {
                productId: p.id,
                order: { placedAt: { gte: sevenDaysAgo }, status: 'DELIVERED' },
              },
              _sum: { quantity: true },
            }),
          ])

          const unitsSold30d = sold30._sum.quantity ?? 0
          const unitsSold7d = sold7._sum.quantity ?? 0
          const avgDailySales = unitsSold30d / 30

          const suggestion = await generateRestockSuggestion(p, {
            unitsSold7d,
            unitsSold30d,
            avgDailySales,
          })

          return { productId: p.id, name: p.name, stockQty: p.stockQty, suggestion }
        })
      )

      return reply.send({ success: true, data: { suggestions } })
    }
  )

  // POST /ai/chat — SSE streaming customer support
  app.post('/chat', { preHandler: [app.authenticate] }, async (request, reply) => {
    const parsed = chatSchema.safeParse(request.body)
    if (!parsed.success) {
      return reply
        .status(400)
        .send({ success: false, error: parsed.error.issues[0]?.message ?? 'Invalid input' })
    }

    const { messages, orderContext } = parsed.data

    // Hijack the connection and stream SSE
    reply.hijack()
    reply.raw.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    })

    try {
      for await (const chunk of streamCustomerSupport(messages, orderContext)) {
        reply.raw.write(`data: ${JSON.stringify({ text: chunk })}\n\n`)
      }
      reply.raw.write('data: [DONE]\n\n')
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Stream error'
      reply.raw.write(`data: ${JSON.stringify({ error: message })}\n\n`)
    } finally {
      reply.raw.end()
    }
  })
}
