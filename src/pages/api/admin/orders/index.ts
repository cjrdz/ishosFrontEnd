/**
 * POST /api/admin/orders
 * GET /api/admin/orders?status=pending
 *
 * Backend forwarding endpoints for order operations
 * Requires: auth_token HttpOnly cookie
 */

import type { APIRoute } from "astro";
import { orderCreateSchema, parseJsonBody } from "@core/bff/validation";
import { proxyToBackend } from "@core/bff/proxy";

export const prerender = false;

export const GET: APIRoute = async (context) => {
  const status = context.url.searchParams.get("status") || "";
  const lite = context.url.searchParams.get("lite") || "";
  const archived = context.url.searchParams.get("archived") || "";
  const page = context.url.searchParams.get("page");
  const perPage = context.url.searchParams.get("per_page");

  const query: Record<string, string> = {};
  if (status) query.status = status;
  if (lite) query.lite = lite;
  if (archived) query.archived = archived;
  if (page) query.page = page;
  if (perPage) query.per_page = perPage;

  return proxyToBackend(context, "/orders", {
    query: Object.keys(query).length > 0 ? query : undefined,
  });
};

export const POST: APIRoute = async (context) => {
  const parsed = await parseJsonBody(context, orderCreateSchema);
  if (!parsed.success) {
    return parsed.response;
  }

  const headers: Record<string, string> = {};
  const idempotencyKey = context.request.headers.get("Idempotency-Key");
  if (idempotencyKey) {
    headers["Idempotency-Key"] = idempotencyKey;
  }

  return proxyToBackend(context, "/orders", {
    method: "POST",
    body: parsed.data,
    headers,
  });
};
