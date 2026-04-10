import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { saveFcmToken } from '../services/notifications.js'

const registerTokenSchema = z.object({
  token: z.string().min(1),
})

export async function notificationRoutes(app: FastifyInstance): Promise<void> {
  // POST /notifications/register-token
  app.post(
    '/register-token',
    { preHandler: [app.authenticate] },
    async (request, reply) => {
      const parsed = registerTokenSchema.safeParse(request.body)
      if (!parsed.success) {
        return reply
          .status(400)
          .send({ success: false, error: parsed.error.issues[0]?.message ?? 'Invalid input' })
      }

      const user = request.user as { id: string }
      await saveFcmToken(user.id, parsed.data.token)

      return reply.send({ success: true, data: { registered: true } })
    }
  )
}
