import prisma from '../lib/prisma.js'
import redis from '../lib/redis.js'
import { dispatchQueue } from '../queues/index.js'
import { haversineKm, RIDER_CUT } from '../lib/commission.js'
import type { DispatchJob } from '../queues/index.js'
import { validateTransition } from '../lib/orderStateMachine.js'

// ─── Redis key helpers ────────────────────────────────────────────────────────

export const redisKeys = {
  offerForRider: (riderId: string, orderId: string) => `job_offer:${riderId}:${orderId}`,
  dispatchState: (orderId: string) => `dispatch:state:${orderId}`,
  currentRider: (orderId: string) => `dispatch:current_rider:${orderId}`,
  fallbacks: (orderId: string) => `dispatch:fallbacks:${orderId}`,
  timeoutJob: (orderId: string, riderId: string) => `timeout-${orderId}-${riderId}`,
  riderLocation: (riderId: string) => `rider:location:${riderId}`,
  riderZone: (riderId: string) => `rider:${riderId}:zone`,
  onlineRiders: (barangay: string) => `online_riders:${barangay}`,
}

// ─── Broadcast helper (dynamic import to avoid circular dep with ws/index) ───

async function emitToRoom(room: string, event: string, data: unknown): Promise<void> {
  try {
    const { getIo } = await import('../ws/index.js')
    getIo().to(room).emit(event, data)
  } catch {
    // Socket.io not yet initialized
  }
}

// ─── Main dispatch ────────────────────────────────────────────────────────────

/**
 * Called by the dispatch BullMQ worker when a 'find-rider' job is processed.
 * Finds the nearest online rider and initiates an offer.
 */
export async function dispatchOrder(job: DispatchJob): Promise<void> {
  const { orderId, deliveryId, pickupLat, pickupLng, attempt } = job

  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: { merchant: { select: { id: true, barangay: true } } },
  })
  if (!order) return

  const barangay = order.merchant.barangay
  const riderIds = await redis.smembers(redisKeys.onlineRiders(barangay))

  if (riderIds.length === 0) {
    await handleNoRiders(job, order)
    return
  }

  // Fetch locations and sort by haversine distance from pickup
  const candidates = (
    await Promise.all(
      riderIds.map(async (riderId) => {
        const locStr = await redis.get(redisKeys.riderLocation(riderId))
        if (!locStr) return null
        const loc = JSON.parse(locStr) as { lat: number; lng: number }
        return { riderId, distance: haversineKm(pickupLat, pickupLng, loc.lat, loc.lng) }
      })
    )
  )
    .filter((r): r is NonNullable<typeof r> => r !== null)
    .sort((a, b) => a.distance - b.distance)

  if (candidates.length === 0) {
    await handleNoRiders(job, order)
    return
  }

  const [nearest, ...fallbacks] = candidates
  const fallbackRiderIds = fallbacks.map((r) => r.riderId)

  // Persist dispatch state so ws handlers can access it
  await redis.setex(
    redisKeys.dispatchState(orderId),
    600,
    JSON.stringify({ deliveryId, fallbackRiderIds, pickupLat, pickupLng, attempt })
  )

  if (!nearest) return // guarded by candidates.length === 0 check above
  await offerToRider(nearest.riderId, orderId, deliveryId, fallbackRiderIds)
}

// ─── Offer a single rider ─────────────────────────────────────────────────────

/**
 * Emits a job:offer event to the rider and schedules a 60-second timeout.
 * Exported so ws/index.ts can call it on job:reject for the next fallback.
 */
export async function offerToRider(
  riderId: string,
  orderId: string,
  deliveryId: string,
  fallbackRiderIds: string[]
): Promise<void> {
  // Mark offer valid for 65s (slightly longer than the 60s client timeout)
  await redis.setex(redisKeys.offerForRider(riderId, orderId), 65, '1')
  await redis.set(redisKeys.currentRider(orderId), riderId, 'EX', 600)
  await redis.set(redisKeys.fallbacks(orderId), JSON.stringify(fallbackRiderIds), 'EX', 600)

  // Build offer payload
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: {
      merchant: { select: { name: true } },
      delivery: { select: { pickupLat: true, pickupLng: true, dropoffLat: true, dropoffLng: true } },
    },
  })
  if (!order?.delivery) return

  const { pickupLat, pickupLng, dropoffLat, dropoffLng } = order.delivery
  const distanceKm = haversineKm(pickupLat, pickupLng, dropoffLat, dropoffLng)
  const estimatedPay = Math.round(Number(order.deliveryFee) * RIDER_CUT * 100) / 100

  await emitToRoom(`rider:${riderId}`, 'job:offer', {
    orderId,
    deliveryId,
    merchantName: order.merchant.name,
    estimatedPay,
    distanceKm: Math.round(distanceKm * 10) / 10,
    expiresIn: 60,
  })

  // Schedule timeout job — named so it can be removed on accept/reject
  await dispatchQueue.add(
    'offer-timeout',
    {
      orderId,
      deliveryId,
      pickupLat,
      pickupLng,
      dropoffLat,
      dropoffLng,
      attempt: 1,
      currentRiderId: riderId,
      fallbackRiderIds,
    },
    {
      delay: 60000,
      jobId: redisKeys.timeoutJob(orderId, riderId),
    }
  )
}

// ─── Timeout handler ──────────────────────────────────────────────────────────

/**
 * Called by the dispatch worker when an offer-timeout job fires.
 * If the rider hasn't responded, move to the next fallback.
 */
export async function handleOfferTimeout(job: DispatchJob): Promise<void> {
  const { orderId, deliveryId, currentRiderId, fallbackRiderIds = [] } = job
  if (!currentRiderId) return

  // Check if offer is still pending (rider may have already accepted/rejected)
  const stillOpen = await redis.exists(redisKeys.offerForRider(currentRiderId, orderId))
  if (!stillOpen) return // Already handled

  // Clear the expired offer
  await redis.del(redisKeys.offerForRider(currentRiderId, orderId))

  if (fallbackRiderIds.length === 0) {
    await failDispatch(orderId, deliveryId)
    return
  }

  const [next, ...remaining] = fallbackRiderIds
  if (!next) return
  await redis.set(redisKeys.fallbacks(orderId), JSON.stringify(remaining), 'EX', 600)
  await offerToRider(next, orderId, deliveryId, remaining)
}

// ─── No-riders handler ────────────────────────────────────────────────────────

async function handleNoRiders(
  job: DispatchJob,
  order: { id: string; merchantId: string }
): Promise<void> {
  const MAX_ATTEMPTS = 5

  if (job.attempt < MAX_ATTEMPTS) {
    await dispatchQueue.add(
      'find-rider',
      { ...job, attempt: job.attempt + 1 },
      { delay: 120_000 } // retry in 2 minutes
    )
    await emitToRoom(`merchant:${order.merchantId}`, 'dispatch:searching', {
      orderId: job.orderId,
      message: 'No available riders — retrying in 2 minutes...',
      attempt: job.attempt,
    })
  } else {
    await failDispatch(job.orderId, job.deliveryId)
  }
}

// ─── Fail entire dispatch ─────────────────────────────────────────────────────

/**
 * Called when all riders decline or no riders are ever found.
 * Cancels the order, restores stock, and notifies both parties.
 * Exported so ws/index.ts can call it on job:reject with no more fallbacks.
 */
export async function failDispatch(orderId: string, deliveryId: string): Promise<void> {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: { items: { select: { productId: true, quantity: true } } },
  })
  if (!order || order.status === 'CANCELLED' || order.status === 'FAILED') return

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
          create: { status: 'FAILED', timestamp: new Date(), notes: 'No riders available' },
        },
      },
    })
    await tx.delivery.update({ where: { id: deliveryId }, data: { status: 'failed' } })
  })

  // Clean up Redis dispatch keys
  await redis.del(
    redisKeys.dispatchState(orderId),
    redisKeys.currentRider(orderId),
    redisKeys.fallbacks(orderId)
  )

  await emitToRoom(`merchant:${order.merchantId}`, 'dispatch:failed', { orderId })
  await emitToRoom(`customer:${order.customerId}`, 'order:update', {
    type: 'DISPATCH_FAILED',
    orderId,
  })
}

// ─── Accept helper (called from ws/index.ts) ─────────────────────────────────

/**
 * Processes a rider accepting a job offer.
 * Returns false if the offer is no longer valid (expired / already taken).
 */
export async function acceptOffer(
  riderId: string,
  orderId: string
): Promise<boolean> {
  // Atomically check + delete offer key
  const offerKey = redisKeys.offerForRider(riderId, orderId)
  const existed = await redis.del(offerKey)
  if (!existed) return false // expired or already acted on

  // Cancel timeout job
  try {
    const job = await dispatchQueue.getJob(redisKeys.timeoutJob(orderId, riderId))
    await job?.remove()
  } catch {
    // Best-effort removal
  }

  // Load dispatch state
  const stateStr = await redis.get(redisKeys.dispatchState(orderId))
  if (!stateStr) return false
  const { deliveryId } = JSON.parse(stateStr) as { deliveryId: string }

  // Update delivery + order atomically
  await prisma.$transaction(async (tx) => {
    await tx.delivery.update({
      where: { id: deliveryId },
      data: { riderId, status: 'assigned' },
    })

    const order = await tx.order.findUnique({ where: { id: orderId } })
    if (!order) return

    validateTransition(order.status, 'PREPARING')

    await tx.order.update({
      where: { id: orderId },
      data: {
        status: 'PREPARING',
        timeline: {
          create: { status: 'PREPARING', timestamp: new Date(), notes: 'Rider assigned' },
        },
      },
    })
  })

  // Mark rider as busy (remove from online set)
  const zone = await redis.get(redisKeys.riderZone(riderId))
  if (zone) await redis.srem(redisKeys.onlineRiders(zone), riderId)

  // Clean up dispatch keys
  await redis.del(
    redisKeys.dispatchState(orderId),
    redisKeys.currentRider(orderId),
    redisKeys.fallbacks(orderId)
  )

  return true
}

/**
 * Processes a rider rejecting a job offer.
 */
export async function rejectOffer(
  riderId: string,
  orderId: string
): Promise<void> {
  await redis.del(redisKeys.offerForRider(riderId, orderId))

  // Cancel timeout job
  try {
    const job = await dispatchQueue.getJob(redisKeys.timeoutJob(orderId, riderId))
    await job?.remove()
  } catch {}

  // Get next fallback
  const stateStr = await redis.get(redisKeys.dispatchState(orderId))
  if (!stateStr) return
  const { deliveryId } = JSON.parse(stateStr) as { deliveryId: string }

  const fallbackStr = await redis.get(redisKeys.fallbacks(orderId))
  const fallbacks: string[] = fallbackStr ? (JSON.parse(fallbackStr) as string[]) : []

  if (fallbacks.length === 0) {
    await failDispatch(orderId, deliveryId)
    return
  }

  const [next, ...remaining] = fallbacks
  if (!next) return
  await redis.set(redisKeys.fallbacks(orderId), JSON.stringify(remaining), 'EX', 600)
  await offerToRider(next, orderId, deliveryId, remaining)
}
