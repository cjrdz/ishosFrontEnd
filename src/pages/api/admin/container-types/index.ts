/**
 * GET /api/admin/container-types
 * POST /api/admin/container-types
 *
 * Backend forwarding endpoints for container type operations
 * Requires: auth_token HttpOnly cookie
 */

import type { APIRoute } from "astro";
import { proxyToBackend } from "@core/bff/proxy";

export const prerender = false;

export const GET: APIRoute = async (context) => {
  return proxyToBackend(context, "/container-types");
};

export const POST: APIRoute = async (context) => {
  try {
    const body = await context.request.json();
    return proxyToBackend(context, "/container-types", {
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
