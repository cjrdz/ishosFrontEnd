/**
 * GET /api/admin/products
 * POST /api/admin/products
 *
 * Backend forwarding endpoints for product operations
 * Requires: auth_token HttpOnly cookie
 */

import type { APIRoute } from "astro";
import { parseJsonBody, productCreateSchema } from "@core/bff/validation";
import { proxyToBackend } from "@core/bff/proxy";
import { requireAdmin } from "@core/bff/guards";

export const prerender = false;

export const GET: APIRoute = async (context) => {
  const includeAll = context.url.searchParams.get("all") === "true";
  const page = context.url.searchParams.get("page");
  const perPage = context.url.searchParams.get("per_page");

  const query: Record<string, string | boolean> = { all: includeAll };
  if (page) query.page = page;
  if (perPage) query.per_page = perPage;

  return proxyToBackend(context, "/products", { query });
};

export const POST: APIRoute = async (context) => {
  // Catalog changes are admin-only (the backend enforces it too).
  const adminError = requireAdmin(context);
  if (adminError) return adminError;
  const parsed = await parseJsonBody(context, productCreateSchema);
  if (!parsed.success) {
    return parsed.response;
  }

  return proxyToBackend(context, "/products", {
    method: "POST",
    body: parsed.data,
  });
};
