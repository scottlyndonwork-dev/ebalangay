import Fastify, { FastifyError, FastifyReply, FastifyRequest } from 'fastify'
import cors from '@fastify/cors'
import helmet from '@fastify/helmet'
import jwt from '@fastify/jwt'
import rateLimit from '@fastify/rate-limit'
import swagger from '@fastify/swagger'
import swaggerUi from '@fastify/swagger-ui'
import multipart from '@fastify/multipart'
import { UserRole } from '@prisma/client'
import prisma from './lib/prisma.js'
import redis from './lib/redis.js'
import {
  inventoryQueue,
  payoutQueue,
  dispatchQueue,
  notificationQueue,
  startWorkers,
  scheduleRecurringJobs,
} from './queues/index.js'

// Fastify type augmentation for custom decorators
declare module 'fastify' {
  interface FastifyInstance {
    authenticate: (request: FastifyRequest, reply: FastifyReply) => Promise<void>
    requireRole: (roles: UserRole[]) => (request: FastifyRequest, reply: FastifyReply) => Promise<void>
  }
}

const app = Fastify({
  logger: process.env.NODE_ENV === 'production' ? true : {
    transport: {
      target: 'pino-pretty',
      options: {
        colorize: true,
        translateTime: 'SYS:standard',
        ignore: 'pid,hostname',
      },
    },
  },
})

async function bootstrap(): Promise<void> {
  try {
    app.log.info('Registering plugins...')

    await app.register(helmet, {
      global: true,
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          scriptSrc: ["'self'", "'unsafe-inline'"],
          styleSrc: ["'self'", "'unsafe-inline'"],
        },
      },
    })

    const allowedOrigins = process.env.ALLOWED_ORIGINS
      ? process.env.ALLOWED_ORIGINS.split(',').map((o) => o.trim())
      : [
          process.env.CUSTOMER_WEB_URL ?? 'http://localhost:3000',
          process.env.MERCHANT_WEB_URL ?? 'http://localhost:3002',
          process.env.ADMIN_WEB_URL ?? 'http://localhost:3003',
        ]

    await app.register(cors, {
      origin: process.env.NODE_ENV === 'development' ? true : allowedOrigins,
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    })

    await app.register(rateLimit, {
      max: 100,
      timeWindow: '1 minute',
      errorResponseBuilder: () => ({
        statusCode: 429,
        error: 'Too Many Requests',
        message: 'Rate limit exceeded. Please try again later.',
      }),
    })

    await app.register(multipart, {
      limits: {
        fieldNameSize: 100,
        fieldSize: 100000,
        fields: 10,
        fileSize: 5242880, // 5MB
        files: 5,
        headerPairs: 2000,
        parts: 1000,
      },
    })

    await app.register(jwt, {
      secret: process.env.JWT_SECRET ?? 'dev-secret-change-in-production',
      sign: { expiresIn: '24h' },
    })

    if (process.env.NODE_ENV !== 'production') {
      await app.register(swagger, {
        openapi: {
          info: {
            title: 'eBalangay API',
            description: 'Community-based delivery & commerce platform',
            version: '1.0.0',
          },
          servers: [{ url: 'http://localhost:3001', description: 'Development' }],
          components: {
            securitySchemes: {
              bearerAuth: { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' },
            },
          },
        },
      })
      await app.register(swaggerUi, {
        routePrefix: '/docs',
        uiConfig: { docExpansion: 'list', deepLinking: false },
      })
    }

    // BullMQ queues + workers
    app.log.info('Initializing BullMQ queues...')
    try {
      app.decorate('inventoryQueue', inventoryQueue)
      app.decorate('payoutQueue', payoutQueue)
      app.decorate('dispatchQueue', dispatchQueue)
      app.decorate('notificationQueue', notificationQueue)
      await startWorkers(app.log)
      await scheduleRecurringJobs()
      app.log.info('✅ BullMQ queues and workers initialized')
    } catch (err) {
      app.log.warn({ err }, '⚠️  BullMQ initialization failed')
    }

    // Root
    app.get('/', async (): Promise<object> => ({
      service: 'eBalangay API',
      version: '1.0.0',
      docs: 'http://localhost:3001/docs',
      health: 'GET /health',
      timestamp: new Date().toISOString(),
    }))

    // Health check
    app.get('/health', async (): Promise<object> => {
      const dbHealth = await prisma.$queryRaw`SELECT 1`
      return {
        status: 'ok',
        timestamp: new Date().toISOString(),
        database: dbHealth ? 'connected' : 'disconnected',
        uptime: process.uptime(),
      }
    })

    // Auth middleware decorators
    app.decorate('authenticate', async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        await request.jwtVerify()
      } catch {
        reply.status(401).send({ success: false, error: 'Unauthorized' })
      }
    })

    app.decorate('requireRole', (roles: UserRole[]) => {
      return async (request: FastifyRequest, reply: FastifyReply) => {
        const user = request.user as { role: UserRole }
        if (!user || !roles.includes(user.role)) {
          reply.status(403).send({ success: false, error: `Required role: ${roles.join(' or ')}` })
        }
      }
    })

    // Register route modules
    app.log.info('Importing route modules...')
    try {
      const [
        { authRoutes },
        { productRoutes },
        { inventoryRoutes },
        { businessRoutes },
        { orderRoutes },
        { webhookRoutes },
        { riderRoutes },
        { deliveryRoutes },
        { analyticsRoutes },
        { aiRoutes },
        { notificationRoutes },
      ] = await Promise.all([
        import('./routes/auth.js'),
        import('./routes/products.js'),
        import('./routes/inventory.js'),
        import('./routes/businesses.js'),
        import('./routes/orders.js'),
        import('./routes/webhooks.js'),
        import('./routes/riders.js'),
        import('./routes/deliveries.js'),
        import('./routes/analytics.js'),
        import('./routes/ai.js'),
        import('./routes/notifications.js'),
      ])

      await app.register(async (f) => authRoutes(f), { prefix: '/auth' })
      await app.register(async (f) => productRoutes(f), { prefix: '/products' })
      await app.register(async (f) => inventoryRoutes(f), { prefix: '/inventory' })
      await app.register(async (f) => businessRoutes(f), { prefix: '/businesses' })
      await app.register(async (f) => orderRoutes(f), { prefix: '/orders' })
      await app.register(async (f) => webhookRoutes(f), { prefix: '/webhooks' })
      await app.register(async (f) => riderRoutes(f), { prefix: '/riders' })
      await app.register(async (f) => deliveryRoutes(f), { prefix: '/deliveries' })
      await app.register(async (f) => analyticsRoutes(f), { prefix: '/analytics' })
      await app.register(async (f) => aiRoutes(f), { prefix: '/ai' })
      await app.register(async (f) => notificationRoutes(f), { prefix: '/notifications' })

      app.log.info('✅ All routes registered')
    } catch (err) {
      app.log.error({ err }, 'Routes registration ERROR')
    }

    // Global error handler
    app.setErrorHandler((error: FastifyError, _request, reply) => {
      app.log.error(error)
      if (error.statusCode === 429) {
        return reply.status(429).send({ error: 'Too Many Requests', message: 'Rate limit exceeded' })
      }
      if (error.statusCode?.toString().startsWith('4')) {
        return reply.status(error.statusCode).send({ error: error.name ?? 'Client Error', message: error.message })
      }
      reply.status(500).send({
        error: 'Internal Server Error',
        message: process.env.NODE_ENV === 'production' ? 'An error occurred' : error.message,
      })
    })

    // Finalize plugin registration before attaching Socket.io
    await app.ready()

    // Socket.io — attach to the underlying HTTP server
    const { initSocketServer } = await import('./ws/index.js')
    initSocketServer(app.server)
    app.log.info('✅ Socket.io initialized')

    const PORT = parseInt(process.env.PORT ?? '3001', 10)
    const HOST = '0.0.0.0'

    await app.listen({ port: PORT, host: HOST })

    app.log.info(`🚀 eBalangay API running on ${HOST}:${PORT}`)
    if (process.env.NODE_ENV !== 'production') {
      app.log.info(`📚 API Documentation: http://localhost:${PORT}/docs`)
      app.log.info(`🔌 Socket.io: ws://localhost:${PORT}`)
    }
  } catch (err) {
    app.log.error(`Bootstrap error: ${err instanceof Error ? err.message : String(err)}`)
    if (err instanceof Error && err.stack) app.log.error(err.stack)
    process.exit(1)
  }
}

async function shutdown(): Promise<void> {
  try {
    await app.close()
    await prisma.$disconnect()
    redis.disconnect()
    process.exit(0)
  } catch (err) {
    app.log.error({ err }, 'Shutdown error')
    process.exit(1)
  }
}

process.on('SIGTERM', shutdown)
process.on('SIGINT', shutdown)

bootstrap().catch((err) => {
  console.error('Fatal error:', err)
  process.exit(1)
})
