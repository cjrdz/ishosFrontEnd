/**
 * PATCH /api/admin/products/{id} - Update product
 * DELETE /api/admin/products/{id} - Delete product
 *
 * Backend forwarding endpoints for specific product operations
 * Requires: auth_token HttpOnly cookie
 */

import type { APIRoute } from "astro";
import { requireUuidParam } from "../../../../lib/bff/params";
import { proxyToBackend } from "../../../../lib/bff/proxy";

export const prerender = false;

export const PATCH: APIRoute = async (context) => {
  const id = requireUuidParam(context, "id");
  if (id instanceof Response) return id;
  try {
    const body = await context.request.json();
    return proxyToBackend(context, `/products/${id}`, {
      method: "PATCH",
      body,
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: "Invalid request body" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }
};

export const DELETE: APIRoute = async (context) => {
  const id = requireUuidParam(context, "id");
  if (id instanceof Response) return id;
  return proxyToBackend(context, `/products/${id}`, { method: "DELETE" });
};
