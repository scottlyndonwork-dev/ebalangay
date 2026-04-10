import { Worker, Job } from 'bullmq'
import redis from '../lib/redis.js'
import { dispatchOrder, handleOfferTimeout } from '../services/dispatch.js'
import type { DispatchJob } from '../queues/index.js'

export function startDispatchWorker(logger: {
  info: (msg: string) => void
  error: (msg: string, ...args: unknown[]) => void
}): Worker<DispatchJob> {
  const worker = new Worker<DispatchJob>(
    'dispatch',
    async (job: Job<DispatchJob>) => {
      if (job.name === 'find-rider') {
        logger.info(`[dispatch] find-rider for order ${job.data.orderId} (attempt ${job.data.attempt})`)
        await dispatchOrder(job.data)
      } else if (job.name === 'offer-timeout') {
        logger.info(`[dispatch] offer-timeout for order ${job.data.orderId}, rider ${job.data.currentRiderId}`)
        await handleOfferTimeout(job.data)
      }
    },
    {
      connection: redis,
      concurrency: 10,
      lockDuration: 90000, // 90s — longer than offer timeout
    }
  )

  worker.on('failed', (job, err) =>
    logger.error(`[dispatch] job ${job?.id} (${job?.name}) failed: ${err.message}`)
  )

  return worker
}
