import { Prisma } from '@prisma/client'
import prisma from './prisma.js'

/**
 * Resolve the unit price for a B2B product at a given quantity.
 * Walks tiers in ascending minQty order, returns the first matching tier's
 * unitPrice, or falls back to product.price if no tier matches.
 */
export async function getB2BPrice(
  productId: string,
  quantity: number
): Promise<Prisma.Decimal> {
  const product = await prisma.product.findUnique({
    where: { id: productId },
    select: {
      price: true,
      b2bPricing: {
        orderBy: { minQty: 'asc' },
      },
    },
  })

  if (!product) throw new Error(`Product ${productId} not found`)

  for (const tier of product.b2bPricing) {
    const withinMax = tier.maxQty === null || quantity <= tier.maxQty
    if (quantity >= tier.minQty && withinMax) {
      return tier.unitPrice
    }
  }

  return product.price
}
