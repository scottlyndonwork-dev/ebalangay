import { Prisma } from '@prisma/client'
import prisma from '../lib/prisma.js'
import { createPaymentIntent } from './paymongo.js'
import {
  haversineKm,
  calculateDeliveryFee,
  calculateCommission,
} from '../lib/commission.js'

export interface CheckoutItem {
  productId: string
  quantity: number
}

export interface CheckoutInput {
  customerId: string
  merchantId: string
  deliveryType: 'DELIVERY' | 'PICKUP'
  items: CheckoutItem[]
  addressLine: string
  barangay: string
  notes?: string
  dropoffLat: number
  dropoffLng: number
}

export interface CheckoutResult {
  orderId: string
  checkoutUrl: string
  totalAmount: number
  paymentIntentId: string
}

/**
 * Checkout with SELECT FOR UPDATE stock locking.
 *
 * Transaction (atomic):
 *   1. Lock product rows (SELECT FOR UPDATE)
 *   2. Verify all products belong to merchantId
 *   3. Validate stock availability
 *   4. Decrement stock
 *   5. Fetch merchant coordinates for delivery fee
 *   6. Create Order + OrderItems + Delivery
 *
 * Post-transaction:
 *   7. Create PayMongo payment intent
 *   8. Create Payment record
 *
 * On PayMongo failure: restore stock + cancel order.
 */
export async function checkout(input: CheckoutInput): Promise<CheckoutResult> {
  // ─── TRANSACTION ────────────────────────────────────────────────────────────
  const { order, totalAmount } = await prisma.$transaction(
    async (tx) => {
      // 1. Lock product rows (SELECT FOR UPDATE)
      const lockedRows = await Promise.all(
        input.items.map((item) =>
          tx.$queryRaw<
            Array<{
              id: string
              name: string
              price: Prisma.Decimal
              stock_qty: number
              business_id: string
              category: string
              is_active: boolean
            }>
          >`
            SELECT id, name, price, stock_qty, business_id, category, is_active
            FROM products
            WHERE id = ${item.productId}
            FOR UPDATE
          `
        )
      )

      // Build map and validate
      const productMap = new Map<
        string,
        {
          id: string
          name: string
          price: Prisma.Decimal
          stockQty: number
          businessId: string
          category: string
        }
      >()

      for (const rows of lockedRows) {
        const p = rows[0]
        if (!p) throw new Error('Product not found')
        if (!p.is_active) throw new Error(`Product "${p.name}" is not available`)
        productMap.set(p.id, {
          id: p.id,
          name: p.name,
          price: p.price,
          stockQty: p.stock_qty,
          businessId: p.business_id,
          category: p.category,
        })
      }

      // 2. Verify all products belong to the declared merchantId
      for (const [, product] of productMap) {
        if (product.businessId !== input.merchantId) {
          throw new Error(
            `Product "${product.name}" does not belong to the specified merchant`
          )
        }
      }

      // 3. Validate stock availability
      for (const item of input.items) {
        const product = productMap.get(item.productId)!
        if (product.stockQty < item.quantity) {
          throw new Error(
            `Insufficient stock for "${product.name}". Available: ${product.stockQty}, requested: ${item.quantity}`
          )
        }
      }

      // 4. Decrement stock
      for (const item of input.items) {
        await tx.product.update({
          where: { id: item.productId },
          data: { stockQty: { decrement: item.quantity } },
        })
      }

      // 5. Fetch merchant + calculate delivery fee
      const business = await tx.business.findUnique({
        where: { id: input.merchantId },
        select: { id: true, type: true, lat: true, lng: true },
      })
      if (!business) throw new Error('Merchant not found')

      let deliveryFee: Prisma.Decimal
      if (
        input.deliveryType === 'DELIVERY' &&
        business.lat != null &&
        business.lng != null
      ) {
        const distKm = haversineKm(
          business.lat,
          business.lng,
          input.dropoffLat,
          input.dropoffLng
        )
        deliveryFee = calculateDeliveryFee(distKm)
      } else {
        deliveryFee = new Prisma.Decimal(0)
      }

      // 6. Calculate subtotal + commission
      let subtotal = new Prisma.Decimal(0)
      const orderItems: Array<{
        productId: string
        quantity: number
        unitPrice: Prisma.Decimal
      }> = []

      for (const item of input.items) {
        const product = productMap.get(item.productId)!
        const lineTotal = product.price.mul(item.quantity)
        subtotal = subtotal.plus(lineTotal)
        orderItems.push({
          productId: item.productId,
          quantity: item.quantity,
          unitPrice: product.price,
        })
      }

      const commission = calculateCommission(subtotal, business.type)
      const totalAmount = subtotal.plus(deliveryFee)

      // 7. Create Order + OrderItems + Delivery
      const order = await tx.order.create({
        data: {
          customerId: input.customerId,
          merchantId: input.merchantId,
          status: 'PLACED',
          subtotal,
          deliveryFee,
          commission,
          totalAmount,
          addressLine: input.addressLine,
          barangay: input.barangay,
          notes: input.notes,
          items: { create: orderItems },
          timeline: {
            create: {
              status: 'PLACED',
              timestamp: new Date(),
              notes: 'Order placed by customer',
            },
          },
          ...(input.deliveryType === 'DELIVERY' && {
            delivery: {
              create: {
                status: 'pending',
                pickupLat: business.lat ?? 0,
                pickupLng: business.lng ?? 0,
                dropoffLat: input.dropoffLat,
                dropoffLng: input.dropoffLng,
              },
            },
          }),
        },
        select: {
          id: true,
          totalAmount: true,
          customerId: true,
          merchantId: true,
        },
      })

      return { order, totalAmount }
    },
    {
      isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted,
      timeout: 30000,
    }
  )

  // ─── POST-TRANSACTION: PayMongo ──────────────────────────────────────────────
  const amountInCentavos = Math.round(Number(totalAmount) * 100)

  let paymentIntentId: string
  let checkoutUrl: string

  try {
    const paymentIntent = await createPaymentIntent({
      amount: amountInCentavos,
      currency: 'PHP',
      description: `Order ${order.id} — eBalangay`,
      statement_descriptor: 'EBALANGAY',
      metadata: {
        orderId: order.id,
        customerId: input.customerId,
        merchantId: input.merchantId,
      },
    })

    paymentIntentId = paymentIntent.id
    checkoutUrl = paymentIntent.attributes.checkout_url ?? ''

    // Create Payment record
    await prisma.payment.create({
      data: {
        orderId: order.id,
        provider: 'paymongo',
        intentId: paymentIntent.id,
        reference: paymentIntent.attributes.reference_number,
        amount: totalAmount,
        status: 'pending',
      },
    })
  } catch (error) {
    // PayMongo failed — restore stock and cancel order
    await prisma.$transaction(async (tx) => {
      for (const item of input.items) {
        await tx.product.update({
          where: { id: item.productId },
          data: { stockQty: { increment: item.quantity } },
        })
      }
      await tx.order.update({
        where: { id: order.id },
        data: {
          status: 'CANCELLED',
          timeline: {
            create: {
              status: 'CANCELLED',
              timestamp: new Date(),
              notes: 'Payment intent creation failed',
            },
          },
        },
      })
    })
    throw error
  }

  return {
    orderId: order.id,
    checkoutUrl,
    totalAmount: Number(totalAmount),
    paymentIntentId,
  }
}
