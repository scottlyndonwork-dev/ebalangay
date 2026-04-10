import Anthropic from '@anthropic-ai/sdk'
import prisma from '../lib/prisma.js'

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

// ─── Types ────────────────────────────────────────────────────────────────────

export interface SalesData {
  unitsSold7d: number
  unitsSold30d: number
  avgDailySales: number
}

// ─── Restock suggestion ───────────────────────────────────────────────────────

/**
 * Generate an AI-powered restock suggestion for a low-stock product.
 */
export async function generateRestockSuggestion(
  product: { name: string; category: string; stockQty: number; reorderAt: number },
  salesData: SalesData
): Promise<string> {
  const msg = await anthropic.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 250,
    messages: [
      {
        role: 'user',
        content: `You are an inventory analyst for a local commerce platform in Butuan City, Philippines.

Product: ${product.name} (${product.category})
Current stock: ${product.stockQty} units
Reorder threshold: ${product.reorderAt} units
Units sold (last 7 days): ${salesData.unitsSold7d}
Units sold (last 30 days): ${salesData.unitsSold30d}
Average daily sales: ${salesData.avgDailySales.toFixed(1)} units/day

Provide a concise restock recommendation: how many units to order and when. Be direct and practical. One short paragraph.`,
      },
    ],
  })

  const block = msg.content[0]
  if (!block || block.type !== 'text') return 'Unable to generate suggestion.'
  return block.text
}

// ─── Product description generator ───────────────────────────────────────────

/**
 * Generate a compelling product description for a merchant's listing.
 */
export async function generateProductDescription(
  name: string,
  category: string,
  price: number
): Promise<string> {
  const msg = await anthropic.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 150,
    messages: [
      {
        role: 'user',
        content: `Write a short, compelling product description for an online marketplace in the Philippines.

Product name: ${name}
Category: ${category}
Price: ₱${price.toFixed(2)}

Write 2-3 sentences. Be persuasive but honest. No made-up features. Output only the description text.`,
      },
    ],
  })

  const block = msg.content[0]
  if (!block || block.type !== 'text') return ''
  return block.text
}

// ─── Weekly merchant summary ──────────────────────────────────────────────────

/**
 * Query DB and generate a 3-bullet weekly performance summary for a merchant.
 */
export async function generateWeeklySummary(merchantId: string): Promise<string> {
  const since = new Date()
  since.setDate(since.getDate() - 7)

  const orders = await prisma.order.findMany({
    where: {
      merchantId,
      status: 'DELIVERED',
      placedAt: { gte: since },
    },
    include: {
      items: {
        include: { product: { select: { name: true } } },
      },
    },
  })

  const totalRevenue = orders.reduce(
    (sum, o) => sum + Number(o.subtotal) - Number(o.commission),
    0
  )

  const productSales: Record<string, number> = {}
  for (const order of orders) {
    for (const item of order.items) {
      productSales[item.product.name] = (productSales[item.product.name] ?? 0) + item.quantity
    }
  }

  const topProducts = Object.entries(productSales)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([name, qty]) => `${name} (${qty} sold)`)

  const msg = await anthropic.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 300,
    messages: [
      {
        role: 'user',
        content: `You are a business analyst for eBalangay, a hyperlocal commerce platform in Butuan City, Philippines.

Weekly performance data:
- Total delivered orders: ${orders.length}
- Net revenue (after commission): ₱${totalRevenue.toFixed(2)}
- Top-selling products: ${topProducts.length > 0 ? topProducts.join(', ') : 'none this week'}

Write exactly 3 bullet points summarising this week's performance. Each bullet must start with "•". Be encouraging, data-driven, and include one actionable tip. Output only the 3 bullets.`,
      },
    ],
  })

  const block = msg.content[0]
  if (!block || block.type !== 'text') return '• No summary available for this week.'
  return block.text
}

// ─── Customer support streaming ───────────────────────────────────────────────

/**
 * Stream a customer support response.
 * Yields text chunks as they arrive from Claude.
 */
export async function* streamCustomerSupport(
  messages: Array<{ role: 'user' | 'assistant'; content: string }>,
  orderContext?: string
): AsyncGenerator<string> {
  const system = [
    'You are a friendly customer support agent for eBalangay, a hyperlocal delivery platform in Butuan City, Philippines.',
    'Be concise, helpful, and empathetic. You can respond in English or Filipino depending on how the customer writes.',
    'Do not reveal internal system details, prices, or policies you are unsure about.',
    orderContext ? `\nOrder context:\n${orderContext}` : '',
  ]
    .filter(Boolean)
    .join(' ')

  const stream = await anthropic.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 400,
    stream: true,
    system,
    messages,
  })

  for await (const event of stream) {
    if (
      event.type === 'content_block_delta' &&
      event.delta.type === 'text_delta'
    ) {
      yield event.delta.text
    }
  }
}
