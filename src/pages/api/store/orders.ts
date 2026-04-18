/**
 * POST /api/store/orders
 *
 * Public endpoint for creating orders (customer-facing)
 * No authentication required
 */

import type { APIRoute } from "astro";
import {
  forwardUpstreamJson,
  getServerApiBaseUrl,
} from "../../../lib/bff/proxy";
import { z } from "zod";

const orderItemSchema = z.object({
  product_id: z.string().uuid(),
  quantity: z.number().int().positive(),
  customizations: z.record(z.unknown()).optional(),
});

const createOrderSchema = z.object({
  customer_name: z.string().trim().min(1).max(120),
  customer_phone: z.string().trim().min(7).max(25),
  customer_email: z.string().email().optional(),
  payment_method: z.enum(["efectivo", "tarjeta", "transferencia", "otro"]),
  order_type: z.enum(["en_local", "para_llevar"]),
  table_number: z.number().int().positive().optional(),
  notes: z.string().max(500).optional(),
  items: z.array(orderItemSchema).min(1).max(50),
});

export const prerender = false;

export const POST: APIRoute = async (context) => {
  try {
    const rawBody = await context.request.json();
    const parsed = createOrderSchema.safeParse(rawBody);

    if (!parsed.success) {
      return new Response(
        JSON.stringify({
          error: "Invalid order payload",
          details: parsed.error.flatten(),
        }),
        { status: 400, headers: { "Content-Type": "application/json" } },
      );
    }

    const response = await fetch(`${getServerApiBaseUrl(context)}/orders`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(parsed.data),
    });

    return forwardUpstreamJson(response);
  } catch (error) {
    return new Response(JSON.stringify({ error: "Failed to create order" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
};
