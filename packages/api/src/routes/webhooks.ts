import { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify'
import { createHmac, timingSafeEqual } from 'crypto'
import prisma from '../lib/prisma.js'

// ─── Signature verification ───────────────────────────────────────────────────

function verifyPaymongoSignature(rawBody: Buffer, signatureHeader: string): boolean {
  const secret = process.env.PAYMONGO_WEBHOOK_SECRET
  if (!secret) return false

  // PayMongo sends: "t=<timestamp>,te=<testSig>,li=<liveSig>"
  const parts = Object.fromEntries(
    signatureHeader.split(',').map((part) => part.split('=') as [string, string])
  )

  const timestamp = parts['t']
  const signature = parts['te'] ?? parts['li'] // test or live signature

  if (!timestamp || !signature) return false

  const payload = `${timestamp}.${rawBody.toString('utf8')}`
  const expected = createHmac('sha256', secret).update(payload).digest('hex')

  try {
    return timingSafeEqual(Buffer.from(signature, 'hex'), Buffer.from(expected, 'hex'))
  } catch {
    return false
  }
}

// ─── Webhook plugin ───────────────────────────────────────────────────────────

export async function webhookRoutes(app: FastifyInstance): Promise<void> {
  // Override content type parser to capture raw body for HMAC verification
  app.addContentTypeParser(
    'application/json',
    { parseAs: 'buffer' },
    (_req, body, done) => {
      try {
        const raw = body as Buffer
        ;(_req as FastifyRequest & { rawBody: Buffer }).rawBody = raw
        done(null, JSON.parse(raw.toString('utf8')))
      } catch (err) {
        done(err as Error)
      }
    }
  )

  /**
   * POST /webhooks/paymongo
   * Handles payment.paid and payment.failed events from PayMongo.
   */
  app.post(
    '/paymongo',
    async (request: FastifyRequest, reply: FastifyReply) => {
      const rawBody = (request as FastifyRequest & { rawBody?: Buffer }).rawBody
      const signatureHeader = request.headers['paymongo-signature'] as string | undefined

      if (!rawBody || !signatureHeader) {
        return reply.status(400).send({ error: 'Missing signature or body' })
      }

      if (!verifyPaymongoSignature(rawBody, signatureHeader)) {
        return reply.status(401).send({ error: 'Invalid signature' })
      }

      const event = request.body as {
        data: {
          attributes: {
            type: string
            data: {
              attributes: {
                metadata?: { orderId?: string }
                status?: string
                payment_intent_id?: string
              }
            }
          }
        }
      }

      const eventType = event?.data?.attributes?.type
      const attributes = event?.data?.attributes?.data?.attributes

      if (!eventType || !attributes) {
        return reply.status(400).send({ error: 'Malformed event payload' })
      }

      app.log.info(`PayMongo webhook: ${eventType}`)

      try {
        if (eventType === 'payment.paid') {
          await handlePaymentPaid(attributes, app)
        } else if (eventType === 'payment.failed') {
          await handlePaymentFailed(attributes, app)
        }
        // Acknowledge all other events with 200
        return reply.status(200).send({ received: true })
      } catch (err) {
        app.log.error({ err }, 'Webhook handler error')
        return reply.status(500).send({ error: 'Internal error processing webhook' })
      }
    }
  )
}

// ─── Event handlers ───────────────────────────────────────────────────────────

async function handlePaymentPaid(
  attributes: { metadata?: { orderId?: string }; payment_intent_id?: string },
  app: FastifyInstance
): Promise<void> {
  const orderId = attributes.metadata?.orderId
  if (!orderId) {
    app.log.warn('payment.paid: missing orderId in metadata')
    return
  }

  const payment = await prisma.payment.findUnique({ where: { orderId } })
  if (!payment) {
    app.log.warn(`payment.paid: no payment record for order ${orderId}`)
    return
  }

  // Update payment status
  await prisma.payment.update({
    where: { orderId },
    data: { status: 'paid', paidAt: new Date() },
  })

  // Confirm order — transition PLACED → CONFIRMED
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: { delivery: true },
  })

  if (!order || order.status !== 'PLACED') {
    app.log.warn(`payment.paid: order ${orderId} not in PLACED state (${order?.status})`)
    return
  }

  const updatedOrder = await prisma.order.update({
    where: { id: orderId },
    data: {
      status: 'CONFIRMED',
      timeline: {
        create: {
          status: 'CONFIRMED',
          timestamp: new Date(),
          notes: 'Payment confirmed via webhook',
        },
      },
    },
    select: { id: true, customerId: true, merchantId: true, status: true },
  })

  // Notify merchant + customer via Socket.io
  try {
    const { getIo } = await import('../ws/index.js')
    const io = getIo()
    io.to(`merchant:${updatedOrder.merchantId}`).emit('order:update', {
      type: 'PAYMENT_CONFIRMED',
      orderId,
      status: updatedOrder.status,
      timestamp: new Date().toISOString(),
    })
    io.to(`customer:${updatedOrder.customerId}`).emit('order:update', {
      type: 'PAYMENT_CONFIRMED',
      orderId,
      status: updatedOrder.status,
      timestamp: new Date().toISOString(),
    })
  } catch {
    // Socket.io not initialized (e.g. in tests) — skip
  }

  app.log.info(`Order ${orderId} confirmed via payment.paid webhook`)
}

async function handlePaymentFailed(
  attributes: { metadata?: { orderId?: string } },
  app: FastifyInstance
): Promise<void> {
  const orderId = attributes.metadata?.orderId
  if (!orderId) {
    app.log.warn('payment.failed: missing orderId in metadata')
    return
  }

  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: { items: { select: { productId: true, quantity: true } } },
  })

  if (!order || order.status === 'CANCELLED' || order.status === 'FAILED') return

  // Restore stock + cancel order atomically
  await prisma.$transaction(async (tx) => {
    for (const item of order.items) {
      await tx.product.update({
        where: { id: item.productId },
        data: { stockQty: { increment: item.quantity } },
      })
    }

    await tx.order.update({
      where: { id: orderId },
      data: {
        status: 'FAILED',
        timeline: {
          create: {
            status: 'FAILED',
            timestamp: new Date(),
            notes: 'Payment failed via webhook',
          },
        },
      },
    })

    await tx.payment.update({
      where: { orderId },
      data: { status: 'failed' },
    })
  })

  // Notify customer
  try {
    const { getIo } = await import('../ws/index.js')
    const io = getIo()
    io.to(`customer:${order.customerId}`).emit('order:update', {
      type: 'PAYMENT_FAILED',
      orderId,
      timestamp: new Date().toISOString(),
    })
  } catch {
    // skip
  }

  app.log.info(`Order ${orderId} failed + stock restored via payment.failed webhook`)
}
