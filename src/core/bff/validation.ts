/**
 * BFF request-body validation schemas.
 *
 * These mirror the backend request structs so malformed payloads are rejected
 * at the BFF layer before they reach the Go backend.
 */

import type { APIContext } from "astro";
import { z } from "zod";

const uuidSchema = z.string().uuid("Invalid UUID");

const orderItemSchema = z.object({
  product_id: uuidSchema,
  quantity: z.number().int().positive("Quantity must be at least 1"),
  customizations: z.record(z.unknown()).optional(),
});

export const productCreateSchema = z.object({
  name: z.string().trim().min(2).max(200),
  description: z.string().trim().max(1000).optional(),
  price: z.number().positive("Price must be greater than 0"),
  category_id: uuidSchema,
  image_path: z.string().trim().max(500).optional(),
  stock_status: z.string().trim().max(40).optional(),
  is_available: z.boolean().optional(),
  exclude_global_flavors: z.boolean().optional(),
  exclude_global_addons: z.boolean().optional(),
  ball_based: z.boolean().optional(),
  ball_quantity: z.number().int().nonnegative().optional(),
  allows_mixed_flavors: z.boolean().optional(),
  free_toppings: z.number().int().nonnegative().optional(),
});

export const productUpdateSchema = productCreateSchema
  .omit({ stock_status: true })
  .partial();

export const categoryCreateSchema = z.object({
  name: z.string().trim().min(2).max(100),
  slug: z
    .string()
    .trim()
    .min(1)
    .max(100)
    .regex(
      /^[a-z0-9-]+$/,
      "Slug must be lowercase letters, numbers, and hyphens",
    ),
  description: z.string().trim().max(1000).optional(),
  image_path: z.string().trim().max(500).optional(),
  display_order: z.number().int().nonnegative().optional(),
});

export const categoryUpdateSchema = categoryCreateSchema.partial();

export const flavorCreateSchema = z.object({
  name: z.string().trim().min(1).max(100),
  display_order: z.number().int().nonnegative().optional(),
  is_seasonal: z.boolean(),
});

export const flavorUpdateSchema = flavorCreateSchema.partial();

export const addonCreateSchema = z.object({
  name: z.string().trim().min(1).max(100),
  price: z.number().nonnegative("Price cannot be negative"),
  group_name: z.string().trim().min(1).max(100).optional(),
  display_order: z.number().int().nonnegative().optional(),
});

export const addonUpdateSchema = addonCreateSchema.partial();

export const orderCreateSchema = z.object({
  customer_name: z.string().trim().min(1).max(120),
  customer_phone: z.string().trim().min(7).max(25),
  customer_email: z.string().email().optional(),
  payment_method: z.enum(["efectivo", "tarjeta", "transferencia", "otro"]),
  amount_received: z.number().nonnegative().optional(),
  order_type: z.enum(["en_local", "para_llevar"]),
  table_number: z.number().int().positive().optional(),
  notes: z.string().trim().max(1000).optional(),
  items: z.array(orderItemSchema).min(1).max(50),
});

export const orderUpdateSchema = orderCreateSchema.partial().extend({
  items: z.array(orderItemSchema).max(50).optional(),
});

export const orderRejectSchema = z.object({
  reason: z.string().trim().min(1).max(500),
});

export const orderStatusSchema = z.object({
  status: z.enum([
    "pendiente_revision",
    "recibida",
    "en_proceso",
    "lista",
    "entregada",
    "cancelada",
  ]),
});

export const orderNotesSchema = z.object({
  notes: z.string().trim().max(1000).nullable(),
});

export const orderApproveSchema = z.object({});

export const orderArchiveSchema = z.object({
  archived: z.boolean(),
});

// Employees
export const employeeCreateSchema = z.object({
  email: z.string().trim().email(),
  password: z.string().trim().min(6).max(100),
  name: z.string().trim().min(1).max(120),
  phone: z.string().trim().min(7).max(25).optional(),
  role: z.enum(["admin", "employee"]),
  state: z.enum(["active", "inactive"]).optional(),
});

export const employeeUpdateSchema = employeeCreateSchema
  .omit({ password: true })
  .partial()
  .extend({
    password: z.string().trim().min(6).max(100).optional(),
  });

// Users (customer directory)
export const userCreateSchema = z.object({
  name: z.string().trim().min(1).max(120),
  user_type: z.enum(["user", "company"]).optional(),
  phone: z.string().trim().min(7).max(25),
  email: z.string().trim().email().optional(),
  status: z.enum(["active", "inactive"]).optional(),
});

export const userUpdateSchema = userCreateSchema.partial();

// Settings
const offerItemSchema = z.object({
  product_id: uuidSchema,
  label: z.string().trim().min(1).max(200),
  note: z.string().trim().max(500).optional(),
  discount_price: z.number().nonnegative().optional(),
  flavor_id: z.string().trim().optional(),
  flavor_ids: z.array(z.string().trim()).optional(),
  expires_at: z.string().trim().min(1),
});

export const storeSettingsUpdateSchema = z.object({
  orders_enabled: z.boolean(),
  offers: z.array(offerItemSchema).max(50),
});

export const archiveConfigUpdateSchema = z.object({
  enabled: z.boolean(),
  age_days: z.number().int().nonnegative(),
  interval_minutes: z.number().int().nonnegative(),
});

export const panelConfigUpdateSchema = z.object({
  auth_cookie_ttl_hours: z.number().int().positive(),
  auth_token_ttl_hours: z.number().int().positive(),
  tracking_token_ttl_hours: z.number().int().positive(),
  inactivity_logout_seconds: z.number().int().nonnegative(),
});

export const tabsSettingsSchema = z.object({
  tab_order: z.array(z.string().trim().min(1)).min(1),
});

// Container types
export const containerTypeCreateSchema = z.object({
  name: z.string().trim().min(1).max(100),
  balls_per_container: z.number().int().positive(),
  is_custom: z.boolean(),
});

export const containerTypeUpdateSchema = containerTypeCreateSchema
  .partial()
  .extend({
    is_active: z.boolean().optional(),
  });

// Inventory
export const inventoryEntrySchema = z.object({
  container_type_id: uuidSchema,
  quantity_containers: z.number().int().positive(),
  balls_per_container: z.number().int().positive().optional(),
});

export const inventoryUnitEntrySchema = z.object({
  quantity: z.number().int().positive(),
});

export const inventoryAdjustmentSchema = z.object({
  quantity: z.number().int(),
  reason: z.string().trim().min(1).max(500),
});

// Auth
export const authLockoutResetSchema = z.object({
  email: z.string().trim().email(),
});

// Upload
export const allowedUploadFolders = [
  "products",
  "categories",
  "flavors",
  "addons",
  "container-types",
  "profile",
  "general",
] as const;

export const deleteImageSchema = z.object({
  path: z.string().trim().min(1).max(500),
});

function validationErrorResponse(
  body: Record<string, unknown>,
  status: number,
): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

type ValidationResult =
  | { success: true; data: unknown }
  | { success: false; response: Response };

export async function parseJsonBody(
  context: APIContext,
  schema: z.ZodTypeAny,
): Promise<ValidationResult> {
  let raw: unknown;
  try {
    raw = await context.request.json();
  } catch {
    return {
      success: false,
      response: validationErrorResponse(
        { error: "Invalid request body", code: "INVALID_JSON" },
        400,
      ),
    };
  }

  const result = schema.safeParse(raw);
  if (!result.success) {
    return {
      success: false,
      response: validationErrorResponse(
        {
          error: "Validation failed",
          code: "VALIDATION_ERROR",
          issues: result.error.issues,
        },
        400,
      ),
    };
  }

  return { success: true, data: result.data };
}
