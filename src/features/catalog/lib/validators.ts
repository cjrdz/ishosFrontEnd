/**
 * Validation schemas for store-related API inputs
 * Using Zod for runtime validation
 */

import { z } from "@core/zod";

/** Same cap as the cart (cart.ts MAX_ITEM_QUANTITY). */
export const MAX_ORDER_ITEM_QUANTITY = 100;

const idList = z.array(z.guid()).max(20);

/**
 * Exactly the keys checkout sends (CartCheckout buildCustomizations); unknown
 * keys are rejected instead of being forwarded to the backend.
 */
const PublicOrderCustomizationsSchema = z.strictObject({
  notes: z.string().trim().max(500).optional(),
  flavor_id: z.guid().optional(),
  flavor_ids: idList.optional(),
  included_addon_ids: idList.optional(),
  extra_addon_ids: idList.optional(),
  addon_ids: idList.optional(),
  topping_selection: z.enum(["none", "selected"]).optional(),
  jalea_selection: z.enum(["none", "selected"]).optional(),
});

const PublicOrderItemSchema = z.object({
  product_id: z.guid(),
  quantity: z.number().int().positive().max(MAX_ORDER_ITEM_QUANTITY),
  customizations: PublicOrderCustomizationsSchema.optional(),
});

export const CreatePublicOrderSchema = z.object({
  /** Pickup location; required by the backend once online orders open. */
  location_id: z.guid().optional(),
  customer_name: z.string().trim().min(1).max(120),
  customer_phone: z.string().trim().min(7).max(25),
  customer_email: z.email().optional(),
  payment_method: z.enum(["efectivo", "tarjeta", "transferencia", "otro"]),
  order_type: z.enum(["en_local", "para_llevar"]),
  table_number: z.number().int().positive().max(999).optional(),
  notes: z.string().max(500).optional(),
  items: z.array(PublicOrderItemSchema).min(1).max(50),
});

export type CreatePublicOrderInput = z.infer<typeof CreatePublicOrderSchema>;
