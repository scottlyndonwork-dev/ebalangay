import { Server, Socket } from 'socket.io'
import type { Server as HttpServer } from 'http'
import { verify } from 'jsonwebtoken'
import redis from '../lib/redis.js'
import prisma from '../lib/prisma.js'
import { acceptOffer, rejectOffer } from '../services/dispatch.js'

let io: Server

export function initSocketServer(httpServer: HttpServer): Server {
  io = new Server(httpServer, {
    cors: {
      origin:
        process.env.NODE_ENV === 'development'
          ? true
          : (process.env.ALLOWED_ORIGINS?.split(',').map((o) => o.trim()) ?? []),
      credentials: true,
    },
    pingTimeout: 60000,
    pingInterval: 25000,
  })

  // JWT auth middleware
  io.use((socket, next) => {
    const token =
      (socket.handshake.auth.token as string | undefined) ??
      (socket.handshake.query.token as string | undefined)

    if (!token) return next(new Error('Missing auth token'))

    try {
      const decoded = verify(
        token,
        process.env.JWT_SECRET ?? 'dev-secret-change-in-production'
      ) as Record<string, unknown>

      socket.data.userId = (decoded.sub ?? decoded.id) as string
      socket.data.role = decoded.role as string
      socket.data.businessId = decoded.businessId as string | undefined
      next()
    } catch {
      next(new Error('Invalid token'))
    }
  })

  io.on('connection', (socket: Socket) => {
    const { userId, role, businessId } = socket.data as {
      userId: string
      role: string
      businessId?: string
    }

    // Auto-join rooms based on role
    void socket.join(`user:${userId}`)

    if (role === 'MERCHANT' && businessId) {
      void socket.join(`merchant:${businessId}`)
    } else if (role === 'CUSTOMER') {
      void socket.join(`customer:${userId}`)
    } else if (role === 'RIDER') {
      void socket.join(`rider:${userId}`)
    } else if (role === 'ADMIN') {
      void socket.join('admin')
    }

    // ─── Rider: real-time location (TTL 30s) ─────────────────────────────────

    socket.on('rider:location', async (data: { lat: number; lng: number }) => {
      if (role !== 'RIDER') return

      await redis.setex(
        `rider:location:${userId}`,
        30,
        JSON.stringify({ lat: data.lat, lng: data.lng, updatedAt: new Date().toISOString() })
      )

      io.to('admin').emit('rider:location:update', {
        riderId: userId,
        lat: data.lat,
        lng: data.lng,
        timestamp: new Date().toISOString(),
      })
    })

    // ─── Rider: accept job offer ──────────────────────────────────────────────

    socket.on('job:accept', async (data: { orderId: string }) => {
      if (role !== 'RIDER') return

      const { orderId } = data
      const accepted = await acceptOffer(userId, orderId)

      if (!accepted) {
        socket.emit('job:offer_expired', { orderId })
        return
      }

      // Fetch updated order to notify merchant + customer
      const order = await prisma.order.findUnique({
        where: { id: orderId },
        select: { customerId: true, merchantId: true },
      })
      const rider = await prisma.user.findUnique({
        where: { id: userId },
        select: { id: true, name: true },
      })

      if (order) {
        io.to(`merchant:${order.merchantId}`).emit('rider:assigned', {
          orderId,
          riderId: userId,
          riderName: rider?.name,
          timestamp: new Date().toISOString(),
        })
        io.to(`customer:${order.customerId}`).emit('order:update', {
          type: 'RIDER_ASSIGNED',
          orderId,
          riderName: rider?.name,
          timestamp: new Date().toISOString(),
        })
      }

      socket.emit('job:accepted', { orderId })
    })

    // ─── Rider: reject job offer ──────────────────────────────────────────────

    socket.on('job:reject', async (data: { orderId: string }) => {
      if (role !== 'RIDER') return

      const { orderId } = data
      await rejectOffer(userId, orderId)

      socket.emit('job:rejected', { orderId })
    })
  })

  return io
}

export function getIo(): Server {
  if (!io) throw new Error('Socket.io server not initialized')
  return io
}

export { io }
