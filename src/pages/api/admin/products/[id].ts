/**
 * PATCH /api/admin/products/{id} - Update product
 * DELETE /api/admin/products/{id} - Delete product
 *
 * Backend forwarding endpoints for specific product operations
 * Requires: auth_token HttpOnly cookie
 */

import type { APIRoute } from "astro";
import { parseJsonBody, productUpdateSchema } from "@core/bff/validation";
import { requireUuidParam } from "@core/bff/params";
import { proxyToBackend } from "@core/bff/proxy";
import { requireAdmin } from "@core/bff/guards";

export const prerender = false;

export const PATCH: APIRoute = async (context) => {
  const id = requireUuidParam(context, "id");
  if (id instanceof Response) return id;

  const parsed = await parseJsonBody(context, productUpdateSchema);
  if (!parsed.success) {
    return parsed.response;
  }

  return proxyToBackend(context, `/products/${id}`, {
    method: "PATCH",
    body: parsed.data,
  });
};

export const DELETE: APIRoute = async (context) => {
  const adminError = requireAdmin(context);
  if (adminError) return adminError;

  const id = requireUuidParam(context, "id");
  if (id instanceof Response) return id;
  return proxyToBackend(context, `/products/${id}`, { method: "DELETE" });
};
