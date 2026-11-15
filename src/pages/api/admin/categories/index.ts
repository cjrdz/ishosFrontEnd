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
import { requireAdmin } from "@core/bff/guards";

export const prerender = false;

export const GET: APIRoute = async (context) => {
  const includeAll = context.url.searchParams.get("all") === "true";
  return proxyToBackend(context, "/categories", {
    query: { all: includeAll },
  });
};

export const POST: APIRoute = async (context) => {
  // Catalog changes are admin-only (the backend enforces it too).
  const adminError = requireAdmin(context);
  if (adminError) return adminError;
  const parsed = await parseJsonBody(context, categoryCreateSchema);
  if (!parsed.success) {
    return parsed.response;
  }

  return proxyToBackend(context, "/categories", {
    method: "POST",
    body: parsed.data,
  });
};
