/**
 * POST /api/store/orders
 *
 * Public endpoint for creating orders (customer-facing)
 * No authentication required
 */

import type { APIRoute } from "astro";
import { z } from "@core/zod";
import { forwardUpstreamJson, getServerApiBaseUrl } from "@core/bff/proxy";
import { clientIdentityHeaders } from "@core/bff/upstream-headers";
import { CreatePublicOrderSchema } from "@features/catalog";
import { idempotencyKeyFrom } from "@core/bff/params";

export const prerender = false;

export const POST: APIRoute = async (context) => {
  try {
    const rawBody = await context.request.json();
    const parsed = CreatePublicOrderSchema.safeParse(rawBody);

    if (!parsed.success) {
      return new Response(
        JSON.stringify({
          error: "Invalid order payload",
          details: z.flattenError(parsed.error),
        }),
        { status: 400, headers: { "Content-Type": "application/json" } },
      );
    }

    const headers: Record<string, string> = {
      ...clientIdentityHeaders(context),
      "Content-Type": "application/json",
    };
    const idempotencyKey = idempotencyKeyFrom(context.request);
    if (idempotencyKey instanceof Response) return idempotencyKey;
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
    // Malformed JSON is the client's fault; anything else is ours.
    if (error instanceof SyntaxError) {
      return new Response(JSON.stringify({ error: "Invalid JSON body" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }
    console.error("[store/orders] failed:", error);
    return new Response(JSON.stringify({ error: "Failed to create order" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
};
