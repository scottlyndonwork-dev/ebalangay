import { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify'
import { z } from 'zod'
import { parse as csvParse } from 'csv-parse/sync'
import { getUser, requireMerchant, AuthUser } from '../middleware/auth.js'
import { checkReorderAlert } from '../workers/inventory.js'
import { uploadToR2, productImageKey, ALLOWED_IMAGE_TYPES, MAX_IMAGE_SIZE } from '../lib/storage.js'
import prisma from '../lib/prisma.js'

// Validation schemas
const b2bPricingSchema = z.object({
  minQty: z.number().int().positive(),
  maxQty: z.number().int().positive().optional(),
  unitPrice: z.number().positive(),
})

const createProductSchema = z.object({
  name: z.string().min(1).max(200),
  description: z.string().max(2000).optional(),
  price: z.number().positive(),
  stockQty: z.number().int().min(0).default(0),
  reorderAt: z.number().int().min(0).default(5),
  category: z.string().min(1).max(50),
  isB2B: z.boolean().default(false),
  b2bPricing: z.array(b2bPricingSchema).optional(),
  sku: z.string().max(50).optional(),
})

const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  category: z.string().optional(),
  search: z.string().optional(),
  merchantId: z.string().optional(),
  isB2B: z.coerce.boolean().optional(),
})

const updateStockSchema = z.object({
  adjustment: z.number().int(),
  reason: z.string().optional(),
})

type CreateProductInput = z.infer<typeof createProductSchema>
type PaginationInput = z.infer<typeof paginationSchema>
type UpdateStockInput = z.infer<typeof updateStockSchema>

// Separate schema for PUT — same as create but adds isActive, excludes b2bPricing
const putProductSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  description: z.string().max(2000).optional(),
  sku: z.string().max(50).optional(),
  price: z.number().positive().optional(),
  stockQty: z.number().int().min(0).optional(),
  reorderAt: z.number().int().min(0).optional(),
  category: z.string().min(1).max(50).optional(),
  isActive: z.boolean().optional(),
})


/**
 * Product routes plugin
 */
export async function productRoutes(app: FastifyInstance): Promise<void> {

  /**
   * POST /products
   * Create new product (merchant only)
   */
  app.post<{ Body: CreateProductInput }>(
    '/',
    {
      onRequest: [app.authenticate, requireMerchant],
      schema: {
        description: 'Create a new product',
        tags: ['Products'],
        body: {
          type: 'object',
          required: ['name', 'price', 'category'],
          properties: {
            name: { type: 'string' },
            description: { type: 'string' },
            price: { type: 'number' },
            stockQty: { type: 'integer', default: 0 },
            reorderAt: { type: 'integer', default: 5 },
            category: { type: 'string' },
            isB2B: { type: 'boolean', default: false },
            b2bPricing: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  minQty: { type: 'integer' },
                  maxQty: { type: 'integer' },
                  unitPrice: { type: 'number' },
                },
              },
            },
            sku: { type: 'string' },
          },
        },
        response: {
          201: { type: 'object' },
        },
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const user = getUser(request) as AuthUser
        const input = createProductSchema.parse(request.body)

        // Get merchant's business
        const business = await prisma.business.findFirst({
          where: { ownerId: user.id },
        })

        if (!business) {
          return reply.status(400).send({
            error: 'No Business Found',
            message: 'You must have a registered business to create products',
          })
        }

        const product = await prisma.product.create({
          data: {
            ...input,
            businessId: business.id,
            b2bPricing: input.b2bPricing
              ? {
                  create: input.b2bPricing,
                }
              : undefined,
          },
          include: {
            b2bPricing: true,
            business: {
              select: {
                id: true,
                name: true,
              },
            },
          },
        })

        return reply.status(201).send({
          data: product,
          message: 'Product created successfully',
        })
      } catch (error) {
        if (error instanceof z.ZodError) {
          return reply.status(400).send({
            error: 'Validation Error',
            issues: error.errors,
          })
        }

        app.log.error({ err: error }, 'Create product error')
        return reply.status(500).send({
          error: 'Internal Server Error',
          message: error instanceof Error ? error.message : 'Unknown error',
        })
      }
    }
  )

  /**
   * GET /products
   * List products with pagination and filters
   */
  app.get<{ Querystring: PaginationInput }>(
    '/',
    {
      schema: {
        description: 'List products',
        tags: ['Products'],
        querystring: {
          type: 'object',
          properties: {
            page: { type: 'integer', default: 1 },
            limit: { type: 'integer', default: 20 },
            category: { type: 'string' },
            search: { type: 'string' },
            merchantId: { type: 'string' },
            isB2B: { type: 'boolean' },
          },
        },
        response: {
          200: { type: 'object' },
        },
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const params = paginationSchema.parse(request.query)
        const { page, limit, category, search, merchantId, isB2B } = params

        const where: any = {}

        // Customers browsing: only active products. Merchant viewing own: all products.
        if (!merchantId) where.isActive = true
        if (merchantId) where.businessId = merchantId

        if (category) where.category = category
        if (isB2B !== undefined) where.isB2B = isB2B
        if (search) {
          where.OR = [
            { name: { contains: search, mode: 'insensitive' } },
            { description: { contains: search, mode: 'insensitive' } },
          ]
        }

        const [products, total] = await Promise.all([
          prisma.product.findMany({
            where,
            include: {
              b2bPricing: true,
              business: {
                select: {
                  id: true,
                  name: true,
                },
              },
            },
            skip: (page - 1) * limit,
            take: limit,
            orderBy: { createdAt: 'desc' },
          }),
          prisma.product.count({ where }),
        ])

        return reply.status(200).send({
          data: products,
          pagination: {
            page,
            limit,
            total,
            pages: Math.ceil(total / limit),
          },
        })
      } catch (error) {
        if (error instanceof z.ZodError) {
          return reply.status(400).send({
            error: 'Validation Error',
            issues: error.errors,
          })
        }

        app.log.error({ err: error }, 'List products error')
        return reply.status(500).send({
          error: 'Internal Server Error',
          message: error instanceof Error ? error.message : 'Unknown error',
        })
      }
    }
  )

  /**
   * GET /products/:id
   * Get single product with full details
   */
  app.get(
    '/:id',
    {
      schema: {
        description: 'Get product details',
        tags: ['Products'],
        params: {
          type: 'object',
          required: ['id'],
          properties: {
            id: { type: 'string' },
          },
        },
        response: {
          200: { type: 'object' },
        },
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const { id } = request.params as { id: string }

        const product = await prisma.product.findUnique({
          where: { id },
          include: {
            b2bPricing: true,
            business: {
              select: {
                id: true,
                name: true,
                type: true,
              },
            },
          },
        })

        if (!product || !product.isActive) {
          return reply.status(404).send({
            error: 'Not Found',
            message: 'Product does not exist',
          })
        }

        return reply.status(200).send({
          data: product,
        })
      } catch (error) {
        app.log.error({ err: error }, 'Get product error')
        return reply.status(500).send({
          error: 'Internal Server Error',
          message: error instanceof Error ? error.message : 'Unknown error',
        })
      }
    }
  )

  /**
   * PUT /products/:id
   * Update product (merchant only, owner only)
   */
  app.put(
    '/:id',
    { onRequest: [app.authenticate, requireMerchant] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const user = getUser(request) as AuthUser
        const { id } = request.params as { id: string }
        const input = putProductSchema.parse(request.body)

        // Verify ownership
        const product = await prisma.product.findUnique({
          where: { id },
          include: {
            business: {
              select: {
                ownerId: true,
              },
            },
          },
        })

        if (!product) {
          return reply.status(404).send({
            error: 'Not Found',
            message: 'Product does not exist',
          })
        }

        if (product.business.ownerId !== user.id) {
          return reply.status(403).send({
            error: 'Forbidden',
            message: 'You can only update your own products',
          })
        }

        const updated = await prisma.product.update({
          where: { id },
          data: input,
          include: {
            b2bPricing: true,
            business: {
              select: { id: true, name: true },
            },
          },
        })

        return reply.status(200).send({
          data: updated,
          message: 'Product updated successfully',
        })
      } catch (error) {
        if (error instanceof z.ZodError) {
          return reply.status(400).send({
            error: 'Validation Error',
            issues: error.errors,
          })
        }

        app.log.error({ err: error }, 'Update product error')
        return reply.status(500).send({
          error: 'Internal Server Error',
          message: error instanceof Error ? error.message : 'Unknown error',
        })
      }
    }
  )

  /**
   * PATCH /products/:id/stock
   * Update product stock only
   */
  app.patch<{ Body: UpdateStockInput }>(
    '/:id/stock',
    {
      onRequest: [app.authenticate, requireMerchant],
      schema: {
        description: 'Update product stock',
        tags: ['Products'],
        params: {
          type: 'object',
          required: ['id'],
          properties: {
            id: { type: 'string' },
          },
        },
        body: {
          type: 'object',
          required: ['quantity'],
          properties: {
            quantity: { type: 'integer' },
            reason: { type: 'string' },
          },
        },
        response: {
          200: { type: 'object' },
        },
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const user = getUser(request) as AuthUser
        const { id } = request.params as { id: string }
        const { adjustment, reason } = updateStockSchema.parse(request.body)
        const quantity = adjustment

        // Verify ownership
        const product = await prisma.product.findUnique({
          where: { id },
          include: {
            business: {
              select: {
                ownerId: true,
              },
            },
          },
        })

        if (!product) {
          return reply.status(404).send({
            error: 'Not Found',
            message: 'Product does not exist',
          })
        }

        if (product.business.ownerId !== user.id) {
          return reply.status(403).send({
            error: 'Forbidden',
            message: 'You can only modify your own products',
          })
        }

        // Calculate new stock
        const newStock = product.stockQty + quantity

        if (newStock < 0) {
          return reply.status(400).send({
            error: 'Invalid Stock',
            message: `Cannot reduce stock below 0 (current: ${product.stockQty}, requested change: ${quantity})`,
          })
        }

        const updated = await prisma.product.update({
          where: { id },
          data: {
            stockQty: newStock,
          },
          select: {
            id: true,
            name: true,
            stockQty: true,
            reorderAt: true,
          },
        })

        // Check and queue restock alert if stock dropped below reorderAt
        await checkReorderAlert(id)

        return reply.status(200).send({
          data: {
            ...updated,
            previousStock: product.stockQty,
            adjustment,
            reason,
          },
          message: 'Stock updated successfully',
        })
      } catch (error) {
        if (error instanceof z.ZodError) {
          return reply.status(400).send({
            error: 'Validation Error',
            issues: error.errors,
          })
        }

        app.log.error({ err: error }, 'Update stock error')
        return reply.status(500).send({
          error: 'Internal Server Error',
          message: error instanceof Error ? error.message : 'Unknown error',
        })
      }
    }
  )

  /**
   * POST /products/:id/image
   * Upload product image to Cloudflare R2
   */
  app.post(
    '/:id/image',
    {
      onRequest: [app.authenticate, requireMerchant],
      schema: {
        description: 'Upload product image',
        tags: ['Products'],
        params: {
          type: 'object',
          required: ['id'],
          properties: {
            id: { type: 'string' },
          },
        },
        response: {
          200: { type: 'object' },
        },
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const user = getUser(request) as AuthUser
        const { id } = request.params as { id: string }

        // Verify ownership
        const product = await prisma.product.findUnique({
          where: { id },
          include: {
            business: {
              select: {
                ownerId: true,
              },
            },
          },
        })

        if (!product) {
          return reply.status(404).send({
            error: 'Not Found',
            message: 'Product does not exist',
          })
        }

        if (product.business.ownerId !== user.id) {
          return reply.status(403).send({
            error: 'Forbidden',
            message: 'You can only upload images for your own products',
          })
        }

        // Get file from request
        const file = await request.file()

        if (!file) {
          return reply.status(400).send({
            error: 'Bad Request',
            message: 'No file provided',
          })
        }

        // Validate file type
        if (!ALLOWED_IMAGE_TYPES.includes(file.mimetype)) {
          return reply.status(400).send({
            success: false,
            error: `Only JPEG, PNG, and WebP allowed. Got: ${file.mimetype}`,
          })
        }

        const buffer = await file.toBuffer()

        if (buffer.length > MAX_IMAGE_SIZE) {
          return reply.status(400).send({
            success: false,
            error: `Max file size is 5 MB. Got: ${(buffer.length / 1024 / 1024).toFixed(2)} MB`,
          })
        }

        const key = productImageKey(id, file.filename)
        const publicUrl = await uploadToR2(buffer, key, file.mimetype)

        // Update product with image URL
        const updated = await prisma.product.update({
          where: { id },
          data: {
            imageUrl: publicUrl,
          },
          select: {
            id: true,
            name: true,
            imageUrl: true,
          },
        })

        return reply.status(200).send({
          data: {
            ...updated,
            imageUrl: publicUrl,
          },
          message: 'Image uploaded successfully',
        })
      } catch (error) {
        app.log.error({ err: error }, 'Upload image error')
        return reply.status(500).send({
          error: 'Internal Server Error',
          message: error instanceof Error ? error.message : 'Unknown error',
        })
      }
    }
  )

  /**
   * DELETE /products/:id
   * Soft delete product (merchant only, owner only)
   */
  app.delete(
    '/:id',
    {
      onRequest: [app.authenticate, requireMerchant],
      schema: {
        description: 'Delete product (soft delete)',
        tags: ['Products'],
        params: {
          type: 'object',
          required: ['id'],
          properties: {
            id: { type: 'string' },
          },
        },
        response: {
          200: { type: 'object' },
        },
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const user = getUser(request) as AuthUser
        const { id } = request.params as { id: string }

        // Verify ownership
        const product = await prisma.product.findUnique({
          where: { id },
          include: {
            business: {
              select: {
                ownerId: true,
              },
            },
          },
        })

        if (!product) {
          return reply.status(404).send({
            error: 'Not Found',
            message: 'Product does not exist',
          })
        }

        if (product.business.ownerId !== user.id) {
          return reply.status(403).send({
            error: 'Forbidden',
            message: 'You can only delete your own products',
          })
        }

        // Soft delete
        await prisma.product.update({
          where: { id },
          data: {
            isActive: false,
          },
        })

        return reply.status(200).send({
          message: 'Product deleted successfully',
        })
      } catch (error) {
        app.log.error({ err: error }, 'Delete product error')
        return reply.status(500).send({
          error: 'Internal Server Error',
          message: error instanceof Error ? error.message : 'Unknown error',
        })
      }
    }
  )

  /**
   * POST /products/bulk-import
   * Import products from CSV (merchant only)
   */
  app.post(
    '/bulk-import',
    {
      onRequest: [app.authenticate, requireMerchant],
      schema: {
        description: 'Bulk import products from CSV',
        tags: ['Products'],
        response: {
          200: { type: 'object' },
        },
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const user = getUser(request) as AuthUser

        // Get merchant's business
        const business = await prisma.business.findFirst({
          where: { ownerId: user.id },
        })

        if (!business) {
          return reply.status(400).send({
            error: 'No Business Found',
            message: 'You must have a registered business to import products',
          })
        }

        // Get file from request
        const file = await request.file()

        if (!file) {
          return reply.status(400).send({
            error: 'Bad Request',
            message: 'No file provided',
          })
        }

        if (!file.mimetype.includes('csv') && !file.filename.endsWith('.csv')) {
          return reply.status(400).send({
            error: 'Invalid File Type',
            message: 'Only CSV files are supported',
          })
        }

        // Read and parse CSV
        const buffer = await file.toBuffer()
        const csvContent = buffer.toString('utf-8')

        const records = csvParse(csvContent, {
          columns: true,
          skip_empty_lines: true,
          relax_column_count: true,
        })

        const results = {
          created: 0,
          updated: 0,
          errors: [] as { row: number; error: string }[],
        }

        // Process each row
        for (let i = 0; i < records.length; i++) {
          try {
            const record = records[i] as Record<string, string>

            // Validate required fields
            if (!record['name'] || !record['price']) {
              results.errors.push({
                row: i + 2,
                error: 'Missing required fields: name, price',
              })
              continue
            }

            const productData = {
              name: record['name'] as string,
              description: record['description'] ?? '',
              price: parseFloat(record['price'] as string),
              stockQty: parseInt(record['stockQty'] ?? '0'),
              reorderAt: parseInt(record['reorderAt'] ?? '5'),
              category: record['category'] ?? 'uncategorized',
              sku: record['sku'] ?? '',
              isB2B: record['isB2B'] === 'true',
            }

            // Check if product exists by SKU
            if (productData.sku) {
              const existing = await prisma.product.findFirst({
                where: {
                  sku: productData.sku,
                  businessId: business.id,
                },
              })

              if (existing) {
                await prisma.product.update({
                  where: { id: existing.id },
                  data: productData,
                })
                results.updated++
                continue
              }
            }

            // Create new product
            await prisma.product.create({
              data: {
                ...productData,
                businessId: business.id,
              },
            })
            results.created++
          } catch (rowError) {
            results.errors.push({
              row: i + 2,
              error: rowError instanceof Error ? rowError.message : 'Unknown error',
            })
          }
        }

        return reply.status(200).send({
          data: results,
          message: `Created ${results.created}, updated ${results.updated}, errors ${results.errors.length}`,
        })
      } catch (error) {
        app.log.error({ err: error }, 'Bulk import error')
        return reply.status(500).send({
          error: 'Internal Server Error',
          message: error instanceof Error ? error.message : 'Unknown error',
        })
      }
    }
  )
}
