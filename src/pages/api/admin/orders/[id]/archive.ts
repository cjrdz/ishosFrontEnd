/**
 * PATCH /api/admin/orders/{id}/archive
 *
 * Toggle archive flag on an order.
 * Requires: auth_token HttpOnly cookie, admin role (enforced by backend).
 */

import type { APIRoute } from "astro";
import { requireUuidParam } from "@core/bff/params";
import { proxyToBackend } from "@core/bff/proxy";

export const prerender = false;

export const PATCH: APIRoute = async (context) => {
  const id = requireUuidParam(context, "id");
  if (id instanceof Response) return id;

  try {
    const body = await context.request.json();
    return proxyToBackend(context, `/orders/${id}/archive`, {
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
