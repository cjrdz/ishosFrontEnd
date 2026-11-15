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
import { idempotencyKeyFrom, parseOptionalBoundedInt } from "@core/bff/params";

export const prerender = false;

export const GET: APIRoute = async (context) => {
  const status = context.url.searchParams.get("status") || "";
  const lite = context.url.searchParams.get("lite") || "";
  const archived = context.url.searchParams.get("archived") || "";
  const page = parseOptionalBoundedInt(
    context.url.searchParams.get("page"),
    1,
    10_000,
  );
  if (page instanceof Response) return page;
  const perPage = parseOptionalBoundedInt(
    context.url.searchParams.get("per_page"),
    1,
    200,
  );
  if (perPage instanceof Response) return perPage;

  const query: Record<string, string> = {};
  if (status) query.status = status;
  if (lite) query.lite = lite;
  if (archived) query.archived = archived;
  if (page !== null) query.page = String(page);
  if (perPage !== null) query.per_page = String(perPage);

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
  const idempotencyKey = idempotencyKeyFrom(context.request);
  if (idempotencyKey instanceof Response) return idempotencyKey;
  if (idempotencyKey) {
    headers["Idempotency-Key"] = idempotencyKey;
  }

  return proxyToBackend(context, "/orders", {
    method: "POST",
    body: parsed.data,
    headers,
  });
};
