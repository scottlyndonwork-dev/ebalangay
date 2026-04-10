import { z } from 'zod'

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
})

export const registerSchema = z.object({
  email: z.string().email(),
  phone: z.string().regex(/^(\+63|0)9\d{9}$/, 'Invalid Philippine mobile number'),
  password: z.string().min(8),
  firstName: z.string().min(1).max(50),
  lastName: z.string().min(1).max(50),
})

export const createProductSchema = z.object({
  name: z.string().min(1).max(200),
  description: z.string().optional(),
  price: z.number().positive(),
  compareAtPrice: z.number().positive().optional(),
  sku: z.string().optional(),
  stock: z.number().int().min(0).default(0),
  lowStockThreshold: z.number().int().min(0).default(5),
  unit: z.string().default('pc'),
  categoryId: z.string().optional(),
})

export const createOrderSchema = z.object({
  merchantId: z.string(),
  addressId: z.string(),
  items: z
    .array(
      z.object({
        productId: z.string(),
        quantity: z.number().int().positive(),
      })
    )
    .min(1),
  paymentMethod: z.enum(['GCASH', 'MAYA', 'CARD', 'CASH_ON_DELIVERY']),
  note: z.string().max(500).optional(),
})

export const paginationSchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
})

export type LoginInput = z.infer<typeof loginSchema>
export type RegisterInput = z.infer<typeof registerSchema>
export type CreateProductInput = z.infer<typeof createProductSchema>
export type CreateOrderInput = z.infer<typeof createOrderSchema>
export type PaginationInput = z.infer<typeof paginationSchema>
