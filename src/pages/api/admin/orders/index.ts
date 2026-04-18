/**
 * POST /api/admin/orders
 * GET /api/admin/orders?status=pending
 *
 * Backend forwarding endpoints for order operations
 * Requires: auth_token HttpOnly cookie
 */

import type { APIRoute } from "astro";
import { proxyToBackend } from "../../../../lib/bff/proxy";

export const prerender = false;

export const GET: APIRoute = async (context) => {
  const status = context.url.searchParams.get("status") || "";
  const query = status ? { status } : undefined;
  return proxyToBackend(context, "/orders", { query });
};

export const POST: APIRoute = async (context) => {
  try {
    const body = await context.request.json();
    return proxyToBackend(context, "/orders", {
      method: "POST",
      body,
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
