import { FastifyRequest, FastifyReply } from 'fastify'
import { UserRole } from '@prisma/client'

export interface AuthUser {
  id: string
  phone: string
  role: UserRole
  iat?: number
  exp?: number
}

/**
 * Decorator for authentication middleware
 * Verifies JWT token and extracts user payload
 */
export async function authMiddleware(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  try {
    await request.jwtVerify()
  } catch (err) {
    reply.status(401).send({
      error: 'Unauthorized',
      message: 'Invalid or missing authentication token',
    })
  }
}

/**
 * Require specific roles for route access
 * Usage: app.post('/route', { onRequest: [app.authenticate, requireRole(['MERCHANT'])] }, handler)
 */
export function requireRole(roles: UserRole[]) {
  return async (request: FastifyRequest, reply: FastifyReply): Promise<void> => {
    const user = request.user as AuthUser
    if (!user || !roles.includes(user.role)) {
      return reply.status(403).send({
        error: 'Forbidden',
        message: `This action requires one of these roles: ${roles.join(', ')}`,
      })
    }
  }
}

/**
 * Require merchant role
 */
export async function requireMerchant(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  const user = request.user as AuthUser
  if (!user || user.role !== 'MERCHANT') {
    return reply.status(403).send({
      error: 'Forbidden',
      message: 'Only merchants can perform this action',
    })
  }
}

/**
 * Require admin role
 */
export async function requireAdmin(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  const user = request.user as AuthUser
  if (!user || user.role !== 'ADMIN') {
    return reply.status(403).send({
      error: 'Forbidden',
      message: 'Only admins can perform this action',
    })
  }
}

/**
 * Get authenticated user from request
 */
export function getUser(request: FastifyRequest): AuthUser {
  return request.user as AuthUser
}
