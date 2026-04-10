import { Redis } from 'ioredis'

const redis = new Redis(process.env.REDIS_URL ?? 'redis://localhost:6379', {
  maxRetriesPerRequest: null,
  enableReadyCheck: false,
  enableOfflineQueue: false,
})

redis.on('error', (err) => {
  console.error('[Redis] connection error:', err.message)
})

redis.on('connect', () => {
  console.info('[Redis] connected')
})

export default redis
