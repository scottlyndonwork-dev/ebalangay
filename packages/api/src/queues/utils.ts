import type { Queue } from 'bullmq'
import type { RestockAlertJob } from './index.js'

/**
 * Get queue statistics and status
 */
export async function getQueueStats(queue: Queue<any>) {
  try {
    const counts = await queue.getJobCounts()
    return {
      name: queue.name,
      counts,
    }
  } catch (error) {
    return {
      name: queue.name,
      error: error instanceof Error ? error.message : 'Unknown error',
    }
  }
}

/**
 * Get all jobs in a queue
 */
export async function getQueueJobs(queue: Queue<any>, status: string = 'all') {
  try {
    let jobs: any[] = []

    if (status === 'all') {
      const completed = await queue.getCompleted(0, 100)
      const failed = await queue.getFailed(0, 100)
      const active = await queue.getActive(0, 100)
      const waiting = await queue.getWaiting(0, 100)
      const delayed = await queue.getDelayed(0, 100)

      jobs = [...completed, ...failed, ...active, ...waiting, ...delayed]
    } else if (status === 'completed') {
      jobs = await queue.getCompleted(0, 100)
    } else if (status === 'failed') {
      jobs = await queue.getFailed(0, 100)
    } else if (status === 'active') {
      jobs = await queue.getActive(0, 100)
    } else if (status === 'waiting') {
      jobs = await queue.getWaiting(0, 100)
    } else if (status === 'delayed') {
      jobs = await queue.getDelayed(0, 100)
    }

    return jobs.map((job) => ({
      id: job.id,
      name: job.name,
      data: job.data,
      progress: job.progress(),
      attempts: job.attemptsMade,
      maxAttempts: job.opts.attempts,
      state: job.getState && job.getState(),
      processedOn: job.processedOn,
      finishedOn: job.finishedOn,
      failedReason: job.failedReason,
      stacktrace: job.stacktrace,
      returnvalue: job.returnvalue,
    }))
  } catch (error) {
    return []
  }
}

/**
 * Retry failed job
 */
export async function retryFailedJob(
  queue: Queue<any>,
  jobId: string
) {
  try {
    const job = await queue.getJob(jobId)
    if (!job) {
      throw new Error(`Job ${jobId} not found`)
    }

    if (await job.isFailed()) {
      await job.retry()
      return { success: true, message: `Job ${jobId} retrying` }
    }

    return { success: false, message: `Job ${jobId} is not in failed state` }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    }
  }
}

/**
 * Remove job from queue
 */
export async function removeJob(
  queue: Queue<any>,
  jobId: string
) {
  try {
    const job = await queue.getJob(jobId)
    if (!job) {
      throw new Error(`Job ${jobId} not found`)
    }

    await job.remove()
    return { success: true, message: `Job ${jobId} removed` }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    }
  }
}

/**
 * Clear queue (remove all jobs)
 */
export async function clearQueue(queue: Queue<any>) {
  try {
    const counts = await queue.clean(0, 1000)
    return {
      success: true,
      message: `Queue ${queue.name} cleaned`,
      details: counts,
    }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    }
  }
}

/**
 * Manually trigger restock alert for testing
 */
export async function triggerRestockAlertManual(
  inventoryQueue: Queue<RestockAlertJob>,
  productId: string,
  businessId: string,
  currentStock: number,
  productName: string
) {
  try {
    const job = await inventoryQueue.add(
      'restock-alert',
      {
        productId,
        businessId,
        currentStock,
        productName,
      },
      {
        priority: currentStock === 0 ? 100 : 50,
        jobId: `manual-alert-${productId}-${Date.now()}`,
      }
    )

    return {
      success: true,
      jobId: job.id,
      message: `Restock alert triggered for product ${productId}`,
    }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    }
  }
}

/**
 * Get restock alert history
 */
export async function getRestockAlertHistory(
  prisma: any,
  businessId: string,
  limit: number = 20
) {
  try {
    const alerts = await prisma.inventoryAlert.findMany({
      where: { businessId },
      include: {
        product: {
          select: {
            id: true,
            name: true,
            sku: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
    })

    return {
      success: true,
      count: alerts.length,
      alerts,
    }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    }
  }
}

/**
 * Get low stock products for a business
 */
export async function getLowStockProducts(
  prisma: any,
  businessId: string
) {
  try {
    const products = await prisma.product.findMany({
      where: {
        businessId,
        isActive: true,
      },
      select: {
        id: true,
        name: true,
        sku: true,
        stockQty: true,
        reorderAt: true,
        price: true,
      },
    })

    const lowStockProducts = products
      .filter((p: any) => p.stockQty <= p.reorderAt)
      .map((p: any) => ({
        ...p,
        urgency:
          p.stockQty === 0
            ? 'out_of_stock'
            : p.stockQty <= Math.floor(p.reorderAt * 0.25)
              ? 'critical'
              : 'low',
        restockNeeded: p.reorderAt - p.stockQty,
      }))

    return {
      success: true,
      total: products.length,
      lowStockCount: lowStockProducts.length,
      products: lowStockProducts,
    }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    }
  }
}
