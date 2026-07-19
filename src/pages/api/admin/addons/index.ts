/**
 * GET /api/admin/addons
 * POST /api/admin/addons
 *
 * Backend forwarding endpoints for addon operations
 * Requires: auth_token HttpOnly cookie
 */

import type { APIRoute } from "astro";
import { addonCreateSchema, parseJsonBody } from "@core/bff/validation";
import { proxyToBackend } from "@core/bff/proxy";

export const prerender = false;

export const GET: APIRoute = async (context) => {
  const includeAll = context.url.searchParams.get("all") === "true";
  return proxyToBackend(context, "/addons", {
    query: { all: includeAll },
  });
};

export const POST: APIRoute = async (context) => {
  const parsed = await parseJsonBody(context, addonCreateSchema);
  if (!parsed.success) {
    return parsed.response;
  }

  return proxyToBackend(context, "/addons", {
    method: "POST",
    body: parsed.data,
  });
};
