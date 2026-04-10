import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3'
import path from 'path'

function getR2Client(): S3Client {
  return new S3Client({
    region: 'auto',
    endpoint: `https://${process.env.CLOUDFLARE_R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: process.env.R2_ACCESS_KEY ?? '',
      secretAccessKey: process.env.R2_SECRET_KEY ?? '',
    },
  })
}

/**
 * Upload a buffer to Cloudflare R2.
 * @param buffer - file contents
 * @param key - full object key, e.g. products/{productId}/{timestamp}.jpg
 * @param contentType - MIME type
 * @returns public URL
 */
export async function uploadToR2(
  buffer: Buffer,
  key: string,
  contentType: string
): Promise<string> {
  const client = getR2Client()
  const bucket = process.env.R2_BUCKET_NAME ?? 'ebalangay'

  await client.send(
    new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      Body: buffer,
      ContentType: contentType,
      CacheControl: 'max-age=31536000',
    })
  )

  const publicBase = (process.env.R2_PUBLIC_URL ?? '').replace(/\/$/, '')
  return `${publicBase}/${key}`
}

/**
 * Build the R2 key for a product image.
 * Pattern: products/{productId}/{timestamp}.{ext}
 */
export function productImageKey(productId: string, originalName: string): string {
  const ext = path.extname(originalName).toLowerCase() || '.jpg'
  return `products/${productId}/${Date.now()}${ext}`
}

export const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp']
export const MAX_IMAGE_SIZE = 5 * 1024 * 1024 // 5 MB
