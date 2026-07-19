/**
 * Validation schemas for store-related API inputs
 * Using Zod for runtime validation
 */

import { z } from "zod";

const PublicOrderItemSchema = z.object({
  product_id: z.string().uuid(),
  quantity: z.number().int().positive(),
  customizations: z.record(z.unknown()).optional(),
});

export const CreatePublicOrderSchema = z.object({
  customer_name: z.string().trim().min(1).max(120),
  customer_phone: z.string().trim().min(7).max(25),
  customer_email: z.string().email().optional(),
  payment_method: z.enum(["efectivo", "tarjeta", "transferencia", "otro"]),
  order_type: z.enum(["en_local", "para_llevar"]),
  table_number: z.number().int().positive().optional(),
  notes: z.string().max(500).optional(),
  items: z.array(PublicOrderItemSchema).min(1).max(50),
});

export type CreatePublicOrderInput = z.infer<typeof CreatePublicOrderSchema>;
