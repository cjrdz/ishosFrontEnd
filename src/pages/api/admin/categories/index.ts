/**
 * GET /api/admin/categories
 * POST /api/admin/categories
 *
 * Backend forwarding endpoints for category operations
 * Requires: auth_token HttpOnly cookie
 */

import type { APIRoute } from "astro";
import { categoryCreateSchema, parseJsonBody } from "@core/bff/validation";
import { proxyToBackend } from "@core/bff/proxy";

export const prerender = false;

export const GET: APIRoute = async (context) => {
  const includeAll = context.url.searchParams.get("all") === "true";
  return proxyToBackend(context, "/categories", {
    query: { all: includeAll },
  });
};

export const POST: APIRoute = async (context) => {
  const parsed = await parseJsonBody(context, categoryCreateSchema);
  if (!parsed.success) {
    return parsed.response;
  }

  return proxyToBackend(context, "/categories", {
    method: "POST",
    body: parsed.data,
  });
};
