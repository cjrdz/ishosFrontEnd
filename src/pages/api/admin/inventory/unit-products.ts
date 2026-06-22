/**
 * GET /api/admin/inventory/unit-products
 * POST /api/admin/inventory/unit-products
 *
 * Backend forwarding endpoints for unit-based inventory items
 * Requires: auth_token HttpOnly cookie
 */

import type { APIRoute } from "astro";
import { proxyToBackend } from "@core/bff/proxy";

export const prerender = false;

export const GET: APIRoute = async (context) => {
  return proxyToBackend(context, "/inventory/unit-products");
};

export const POST: APIRoute = async (context) => {
  try {
    const body = await context.request.json();
    return proxyToBackend(context, "/inventory/unit-products", {
      method: "POST",
      body,
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: "Invalid request body" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }
};
