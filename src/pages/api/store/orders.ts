/**
 * POST /api/store/orders
 *
 * Public endpoint for creating orders (customer-facing)
 * No authentication required
 */

import type { APIRoute } from "astro";
import { forwardUpstreamJson, getServerApiBaseUrl } from "@core/bff/proxy";
import { CreatePublicOrderSchema } from "@features/catalog";

export const prerender = false;

export const POST: APIRoute = async (context) => {
  try {
    const rawBody = await context.request.json();
    const parsed = CreatePublicOrderSchema.safeParse(rawBody);

    if (!parsed.success) {
      return new Response(
        JSON.stringify({
          error: "Invalid order payload",
          details: parsed.error.flatten(),
        }),
        { status: 400, headers: { "Content-Type": "application/json" } },
      );
    }

    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };
    const idempotencyKey = context.request.headers.get("Idempotency-Key");
    if (idempotencyKey) {
      headers["Idempotency-Key"] = idempotencyKey;
    }

    const response = await fetch(`${getServerApiBaseUrl(context)}/orders`, {
      method: "POST",
      headers,
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
