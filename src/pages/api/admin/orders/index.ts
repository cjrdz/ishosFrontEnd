/**
 * POST /api/admin/orders
 * GET /api/admin/orders?status=pending
 *
 * Backend forwarding endpoints for order operations
 * Requires: auth_token HttpOnly cookie
 */

import type { APIRoute } from "astro";
import { proxyToBackend } from "@core/bff/proxy";

export const prerender = false;

export const GET: APIRoute = async (context) => {
  const status = context.url.searchParams.get("status") || "";
  const lite = context.url.searchParams.get("lite") || "";
  const archived = context.url.searchParams.get("archived") || "";
  const query: Record<string, string> = {};
  if (status) query.status = status;
  if (lite) query.lite = lite;
  if (archived) query.archived = archived;
  return proxyToBackend(context, "/orders", {
    query: Object.keys(query).length > 0 ? query : undefined,
  });
};

export const POST: APIRoute = async (context) => {
  try {
    const body = await context.request.json();
    const headers: Record<string, string> = {};
    const idempotencyKey = context.request.headers.get("Idempotency-Key");
    if (idempotencyKey) {
      headers["Idempotency-Key"] = idempotencyKey;
    }
    return proxyToBackend(context, "/orders", {
      method: "POST",
      body,
      headers,
    });
  } catch (error) {
    return new Response(
      JSON.stringify({
        error: "Invalid request body",
        code: "VALIDATION_ERROR",
      }),
      { status: 400, headers: { "Content-Type": "application/json" } },
    );
  }
};
