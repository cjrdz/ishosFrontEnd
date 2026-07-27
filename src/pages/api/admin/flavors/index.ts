/**
 * GET /api/admin/flavors
 * POST /api/admin/flavors
 *
 * Backend forwarding endpoints for flavor operations
 * Requires: auth_token HttpOnly cookie
 */

import type { APIRoute } from "astro";
import { flavorCreateSchema, parseJsonBody } from "@core/bff/validation";
import { proxyToBackend } from "@core/bff/proxy";

export const prerender = false;

export const GET: APIRoute = async (context) => {
  const includeAll = context.url.searchParams.get("all") === "true";
  return proxyToBackend(context, "/flavors", {
    query: { all: includeAll },
  });
};

export const POST: APIRoute = async (context) => {
  const parsed = await parseJsonBody(context, flavorCreateSchema);
  if (!parsed.success) {
    return parsed.response;
  }

  return proxyToBackend(context, "/flavors", {
    method: "POST",
    body: parsed.data,
  });
};
