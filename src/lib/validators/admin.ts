/**
 * Validation schemas for admin-related API inputs
 * Using Zod for runtime validation
 */

import { z } from 'zod';

/**
 * Validate login credentials
 */
export const LoginSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
});

export type LoginInput = z.infer<typeof LoginSchema>;

/**
 * Validate employee creation
 */
export const CreateEmployeeSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  name: z.string().min(2, 'Name must be at least 2 characters').max(100),
  phone: z.string().regex(/^\d{10,}$/, 'Invalid phone number'),
  role: z.enum(['admin', 'manager', 'staff']),
});

export type CreateEmployeeInput = z.infer<typeof CreateEmployeeSchema>;

/**
 * Validate employee update
 */
export const UpdateEmployeeSchema = z.object({
  name: z.string().min(2).max(100),
  phone: z.string().regex(/^\d{10,}$/),
  role: z.enum(['admin', 'manager', 'staff']),
  active: z.boolean(),
});

export type UpdateEmployeeInput = z.infer<typeof UpdateEmployeeSchema>;

/**
 * Validate product creation
 */
export const CreateProductSchema = z.object({
  name: z.string().min(2).max(200),
  description: z.string().max(1000),
  price: z.number().positive('Price must be greater than 0'),
  category_id: z.string().uuid('Invalid category ID'),
  stock: z.number().int().nonnegative('Stock cannot be negative'),
  active: z.boolean().default(true),
});

export type CreateProductInput = z.infer<typeof CreateProductSchema>;

/**
 * Validate category creation
 */
export const CreateCategorySchema = z.object({
  name: z.string().min(2).max(100),
  description: z.string().max(500).optional(),
  priority: z.number().int().nonnegative().default(0),
  active: z.boolean().default(true),
});

export type CreateCategoryInput = z.infer<typeof CreateCategorySchema>;

/**
 * Validate order status update
 */
export const UpdateOrderStatusSchema = z.object({
  status: z.enum(['pending', 'confirmed', 'preparing', 'ready', 'completed', 'cancelled']),
});

export type UpdateOrderStatusInput = z.infer<typeof UpdateOrderStatusSchema>;
