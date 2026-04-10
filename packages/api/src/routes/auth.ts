import { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify'
import { z } from 'zod'
import { UserRole } from '@prisma/client'
import bcrypt from 'bcrypt'
import prisma from '../lib/prisma.js'
import redis from '../lib/redis.js'

// ─── Schemas ──────────────────────────────────────────────────────────────────

const phoneRegex = /^\+639\d{9}$/

const registerSchema = z.object({
  phone: z.string().regex(phoneRegex, 'Phone must be in format +639XXXXXXXXX'),
  name: z.string().min(1).max(100),
  role: z.enum(['CUSTOMER', 'MERCHANT', 'RIDER']).default('CUSTOMER'),
})

const verifyOtpSchema = z.object({
  phone: z.string().regex(phoneRegex, 'Phone must be in format +639XXXXXXXXX'),
  otp: z.string().regex(/^\d{6}$/, 'OTP must be 6 digits'),
  name: z.string().min(1).max(100),
  role: z.enum(['CUSTOMER', 'MERCHANT', 'RIDER']).default('CUSTOMER'),
})

const loginSchema = z.union([
  z.object({
    phone: z.string().regex(phoneRegex, 'Phone must be in format +639XXXXXXXXX'),
    password: z.string().min(8),
    otp: z.undefined(),
  }),
  z.object({
    phone: z.string().regex(phoneRegex, 'Phone must be in format +639XXXXXXXXX'),
    otp: z.string().regex(/^\d{6}$/, 'OTP must be 6 digits'),
    password: z.undefined(),
  }),
])

const refreshSchema = z.object({
  refreshToken: z.string(),
})

// ─── Types ────────────────────────────────────────────────────────────────────

interface JwtPayload {
  id: string
  phone: string
  role: UserRole
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function generateOtp(): string {
  return Math.floor(100000 + Math.random() * 900000).toString()
}

function issueTokens(app: FastifyInstance, payload: JwtPayload) {
  const accessToken = app.jwt.sign(payload, { expiresIn: '15m' })
  const refreshToken = app.jwt.sign(payload, { expiresIn: '30d' })
  return { accessToken, refreshToken }
}

async function sendOtpSms(phone: string, otp: string): Promise<void> {
  // TODO: integrate Semaphore SMS API for production
  // await semaphoreClient.send({ to: phone, message: `Your eBalangay OTP: ${otp}. Valid 5 minutes.` })
  console.log(`[SMS] OTP for ${phone}: ${otp}`)
}

// ─── Routes ───────────────────────────────────────────────────────────────────

export async function authRoutes(app: FastifyInstance): Promise<void> {

  /**
   * POST /auth/register
   * Send OTP to phone number (works for new and existing users)
   */
  app.post('/register', async (request: FastifyRequest, reply: FastifyReply) => {
    const result = registerSchema.safeParse(request.body)
    if (!result.success) {
      return reply.status(400).send({ success: false, error: result.error.errors[0]?.message })
    }
    const { phone, name, role } = result.data

    const otp = generateOtp()
    const OTP_TTL = 5 * 60 // 5 minutes

    await redis.setex(`otp:${phone}`, OTP_TTL, JSON.stringify({ otp, name, role }))

    if (process.env.NODE_ENV !== 'production') {
      console.log(`[DEV] OTP for ${phone}: ${otp}`)
    } else {
      await sendOtpSms(phone, otp)
    }

    return reply.status(200).send({
      success: true,
      data: {
        message: 'OTP sent',
        ...(process.env.NODE_ENV !== 'production' && { devOtp: otp }),
      },
    })
  })

  /**
   * POST /auth/verify-otp
   * Verify OTP and create new user account
   */
  app.post('/verify-otp', async (request: FastifyRequest, reply: FastifyReply) => {
    const result = verifyOtpSchema.safeParse(request.body)
    if (!result.success) {
      return reply.status(400).send({ success: false, error: result.error.errors[0]?.message })
    }
    const { phone, otp, name, role } = result.data

    const stored = await redis.get(`otp:${phone}`)
    if (!stored) {
      return reply.status(401).send({ success: false, error: 'OTP expired or not found' })
    }

    const { otp: storedOtp } = JSON.parse(stored) as { otp: string }
    if (otp !== storedOtp) {
      return reply.status(401).send({ success: false, error: 'Invalid OTP' })
    }

    await redis.del(`otp:${phone}`)

    const existing = await prisma.user.findUnique({ where: { phone } })
    if (existing) {
      return reply.status(400).send({ success: false, error: 'User already exists. Use /auth/login.' })
    }

    const user = await prisma.user.create({
      data: { phone, name, role: role as UserRole },
    })

    const { accessToken, refreshToken } = issueTokens(app, { id: user.id, phone: user.phone, role: user.role })
    await redis.setex(`refresh:${user.id}`, 60 * 60 * 24 * 30, refreshToken)

    return reply.status(201).send({
      success: true,
      data: {
        accessToken,
        refreshToken,
        user: { id: user.id, phone: user.phone, name: user.name, role: user.role },
      },
    })
  })

  /**
   * POST /auth/login
   * Phone + password OR phone + OTP for existing users
   */
  app.post('/login', async (request: FastifyRequest, reply: FastifyReply) => {
    const result = loginSchema.safeParse(request.body)
    if (!result.success) {
      return reply.status(400).send({ success: false, error: result.error.errors[0]?.message })
    }
    const { phone } = result.data

    const user = await prisma.user.findUnique({ where: { phone } })
    if (!user) {
      return reply.status(401).send({ success: false, error: 'Invalid credentials' })
    }

    if ('otp' in result.data && result.data.otp) {
      // OTP login path
      const stored = await redis.get(`otp:${phone}`)
      if (!stored) {
        return reply.status(401).send({ success: false, error: 'OTP expired or not found' })
      }
      const { otp: storedOtp } = JSON.parse(stored) as { otp: string }
      if (result.data.otp !== storedOtp) {
        return reply.status(401).send({ success: false, error: 'Invalid OTP' })
      }
      await redis.del(`otp:${phone}`)
    } else if ('password' in result.data && result.data.password) {
      // Password login path
      if (!user.passwordHash) {
        return reply.status(401).send({ success: false, error: 'Invalid credentials' })
      }
      const valid = await bcrypt.compare(result.data.password, user.passwordHash)
      if (!valid) {
        return reply.status(401).send({ success: false, error: 'Invalid credentials' })
      }
    }

    const { accessToken, refreshToken } = issueTokens(app, { id: user.id, phone: user.phone, role: user.role })
    await redis.setex(`refresh:${user.id}`, 60 * 60 * 24 * 30, refreshToken)

    return reply.status(200).send({
      success: true,
      data: {
        accessToken,
        refreshToken,
        user: { id: user.id, phone: user.phone, name: user.name, role: user.role },
      },
    })
  })

  /**
   * POST /auth/refresh
   * Exchange refresh token for a new token pair
   */
  app.post('/refresh', async (request: FastifyRequest, reply: FastifyReply) => {
    const result = refreshSchema.safeParse(request.body)
    if (!result.success) {
      return reply.status(400).send({ success: false, error: result.error.errors[0]?.message })
    }
    const { refreshToken } = result.data

    let payload: JwtPayload
    try {
      payload = app.jwt.verify<JwtPayload>(refreshToken)
    } catch {
      return reply.status(401).send({ success: false, error: 'Invalid or expired refresh token' })
    }

    const stored = await redis.get(`refresh:${payload.id}`)
    if (!stored || stored !== refreshToken) {
      return reply.status(401).send({ success: false, error: 'Refresh token revoked' })
    }

    const user = await prisma.user.findUnique({ where: { id: payload.id } })
    if (!user) {
      return reply.status(401).send({ success: false, error: 'User not found' })
    }

    const tokens = issueTokens(app, { id: user.id, phone: user.phone, role: user.role })
    await redis.del(`refresh:${user.id}`)
    await redis.setex(`refresh:${user.id}`, 60 * 60 * 24 * 30, tokens.refreshToken)

    return reply.status(200).send({ success: true, data: tokens })
  })

  /**
   * POST /auth/logout
   * Revoke refresh token
   */
  app.post(
    '/logout',
    { onRequest: [app.authenticate] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const user = request.user as JwtPayload
      await redis.del(`refresh:${user.id}`)
      return reply.status(200).send({ success: true, data: null })
    }
  )

  /**
   * GET /auth/me
   * Get current user profile
   */
  app.get(
    '/me',
    { onRequest: [app.authenticate] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { id } = request.user as JwtPayload
      const user = await prisma.user.findUnique({
        where: { id },
        select: { id: true, phone: true, name: true, email: true, role: true, avatarUrl: true, createdAt: true },
      })
      if (!user) {
        return reply.status(401).send({ success: false, error: 'User not found' })
      }
      return reply.status(200).send({ success: true, data: { user } })
    }
  )
}
