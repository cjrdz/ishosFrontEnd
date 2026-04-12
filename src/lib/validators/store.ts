/**
 * Validation schemas for store-related API inputs
 * Using Zod for runtime validation
 */

import { z } from 'zod';

/**
 * Validate product list query parameters
 */
export const ProductListSchema = z.object({
  category: z.string().optional(),
  limit: z.number().int().positive().max(100).default(20),
  offset: z.number().int().nonnegative().default(0),
});

export type ProductListQuery = z.infer<typeof ProductListSchema>;

/**
 * Validate cart item creation
 */
export const CartItemSchema = z.object({
  product_id: z.string().uuid('Invalid product ID'),
  quantity: z.number().int().positive('Quantity must be at least 1'),
});

export type CartItemInput = z.infer<typeof CartItemSchema>;

/**
 * Validate order creation
 */
export const CreateOrderSchema = z.object({
  customer_name: z.string().min(2, 'Name must be at least 2 characters').max(100),
  customer_phone: z.string().regex(/^\d{10,}$/, 'Invalid phone number'),
  customer_email: z.string().email('Invalid email').optional(),
  items: z
    .array(CartItemSchema)
    .min(1, 'Order must have at least one item')
    .max(50, 'Order cannot have more than 50 items'),
  notes: z.string().max(500, 'Notes too long').optional(),
});

export type CreateOrderInput = z.infer<typeof CreateOrderSchema>;
