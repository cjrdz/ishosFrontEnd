/**
 * POST /api/admin/inventory/{id}/adjustments
 *
 * Backend forwarding endpoint for recording inventory adjustment
 * Requires: auth_token HttpOnly cookie
 */

import type { APIRoute } from "astro";
import { requireUuidParam } from "@core/bff/params";
import { proxyToBackend } from "@core/bff/proxy";

export const prerender = false;

export const POST: APIRoute = async (context) => {
  const id = requireUuidParam(context, "id");
  if (id instanceof Response) return id;
  try {
    const body = await context.request.json();
    return proxyToBackend(context, `/inventory/${id}/adjustments`, {
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
