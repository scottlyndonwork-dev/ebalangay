import Fastify from 'fastify'
import cors from '@fastify/cors'
import helmet from '@fastify/helmet'
import jwt from '@fastify/jwt'
import rateLimit from '@fastify/rate-limit'
import swagger from '@fastify/swagger'
import swaggerUi from '@fastify/swagger-ui'

const app = Fastify({
  logger: true,
})

async function bootstrap() {
  // Security
  await app.register(helmet, { global: true })
  await app.register(cors, {
    origin: [
      process.env.CUSTOMER_WEB_URL ?? 'http://localhost:3000',
      process.env.MERCHANT_WEB_URL ?? 'http://localhost:3002',
      process.env.ADMIN_WEB_URL ?? 'http://localhost:3003',
    ],
    credentials: true,
  })
  await app.register(rateLimit, { max: 100, timeWindow: '1 minute' })

  // Auth
  await app.register(jwt, {
    secret: process.env.JWT_SECRET ?? 'dev-secret-change-in-production',
  })

  // Docs (dev only)
  if (process.env.NODE_ENV !== 'production') {
    await app.register(swagger, {
      openapi: {
        info: { title: 'eBalangay API', version: '1.0.0' },
        components: {
          securitySchemes: {
            bearerAuth: { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' },
          },
        },
      },
    })
    await app.register(swaggerUi, { routePrefix: '/docs' })
  }

  // Health check
  app.get('/health', async () => ({ status: 'ok', timestamp: new Date().toISOString() }))

  // TODO: Register route plugins here
  // await app.register(authRoutes, { prefix: '/api/v1/auth' })
  // await app.register(merchantRoutes, { prefix: '/api/v1/merchants' })
  // await app.register(productRoutes, { prefix: '/api/v1/products' })
  // await app.register(orderRoutes, { prefix: '/api/v1/orders' })
  // await app.register(riderRoutes, { prefix: '/api/v1/riders' })
  // await app.register(paymentRoutes, { prefix: '/api/v1/payments' })
  // await app.register(aiRoutes, { prefix: '/api/v1/ai' })

  const port = Number(process.env.PORT ?? 3001)
  await app.listen({ port, host: '0.0.0.0' })
  app.log.info(`eBalangay API running on port ${port}`)
  if (process.env.NODE_ENV !== 'production') {
    app.log.info(`Swagger docs: http://localhost:${port}/docs`)
  }
}

bootstrap().catch((err) => {
  console.error(err)
  process.exit(1)
})
