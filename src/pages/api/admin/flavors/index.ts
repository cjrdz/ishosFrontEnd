/**
 * GET /api/admin/flavors
 * POST /api/admin/flavors
 *
 * Backend forwarding endpoints for flavor operations
 * Requires: auth_token HttpOnly cookie
 */

import type { APIRoute } from "astro";
import { proxyToBackend } from "../../../../lib/bff/proxy";

export const prerender = false;

export const GET: APIRoute = async (context) => {
  const includeAll = context.url.searchParams.get("all") === "true";
  return proxyToBackend(context, "/flavors", {
    query: { all: includeAll },
  });
};

export const POST: APIRoute = async (context) => {
  try {
    const body = await context.request.json();
    return proxyToBackend(context, "/flavors", {
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
