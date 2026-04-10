import { Worker } from 'bullmq'
import admin from 'firebase-admin'
import { Prisma } from '@prisma/client'
import redis from '../lib/redis.js'
import prisma from '../lib/prisma.js'
import type { NotificationJob } from '../queues/index.js'

// ─── Firebase init ────────────────────────────────────────────────────────────

let firebaseReady = false

try {
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT_JSON
  if (raw) {
    const serviceAccount = JSON.parse(raw) as admin.ServiceAccount
    admin.initializeApp({ credential: admin.credential.cert(serviceAccount) })
    firebaseReady = true
  }
} catch {
  // Firebase not configured — push notifications will be skipped
}

// ─── FCM token helpers ────────────────────────────────────────────────────────

const FCM_TTL = 365 * 24 * 3600 // 1 year in seconds

export async function saveFcmToken(userId: string, token: string): Promise<void> {
  await redis.setex(`fcm:${userId}`, FCM_TTL, token)
}

async function getFcmToken(userId: string): Promise<string | null> {
  return redis.get(`fcm:${userId}`)
}

// ─── Send a single push notification ─────────────────────────────────────────

async function sendPush(
  token: string,
  title: string,
  body: string,
  data?: Record<string, string>
): Promise<void> {
  if (!firebaseReady) return

  await admin.messaging().send({
    token,
    notification: { title, body },
    data,
    android: { priority: 'high' },
    apns: { payload: { aps: { sound: 'default' } } },
  })
}

// ─── Worker bootstrap ─────────────────────────────────────────────────────────

type Logger = {
  info: (msg: string) => void
  warn: (msg: string) => void
  error: (msg: string, ...args: unknown[]) => void
}

export function startNotificationWorker(logger: Logger): void {
  if (!firebaseReady) {
    logger.warn('FIREBASE_SERVICE_ACCOUNT_JSON not set — push notifications disabled')
  }

  const worker = new Worker<NotificationJob>(
    'notification',
    async (job) => {
      const { userId, title, body, type, metadata, data } = job.data

      // 1. Persist to DB for in-app notification history
      await prisma.notification.create({
        data: {
          userId,
          type,
          title,
          body,
          metadata: (metadata ?? {}) as Prisma.InputJsonValue,
          status: 'sent',
        },
      })

      // 2. Push via FCM if token exists
      const token = await getFcmToken(userId)
      if (token) {
        await sendPush(token, title, body, data)
      }
    },
    {
      connection: redis,
      concurrency: 5,
    }
  )

  worker.on('failed', (job, err) => {
    logger.error(`Notification job failed for user ${job?.data?.userId ?? 'unknown'}`, err)
  })

  worker.on('error', (err) => {
    logger.error('Notification worker error', err)
  })

  logger.info('Notification worker started')
}
