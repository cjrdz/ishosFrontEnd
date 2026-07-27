/**
 * PATCH /api/admin/orders/{id}/archive
 *
 * Toggle archive flag on an order.
 * Requires: auth_token HttpOnly cookie, admin role (enforced by backend).
 */

import type { APIRoute } from "astro";
import { orderArchiveSchema, parseJsonBody } from "@core/bff/validation";
import { requireUuidParam } from "@core/bff/params";
import { proxyToBackend } from "@core/bff/proxy";
import { requireRole } from "@core/bff/guards";

export const prerender = false;

export const PATCH: APIRoute = async (context) => {
  const roleError = requireRole(context, [
    "admin",
    "manager",
    "staff",
    "employee",
  ]);
  if (roleError) return roleError;

  const id = requireUuidParam(context, "id");
  if (id instanceof Response) return id;

  const parsed = await parseJsonBody(context, orderArchiveSchema);
  if (!parsed.success) {
    return parsed.response;
  }

  return proxyToBackend(context, `/orders/${id}/archive`, {
    method: "PATCH",
    body: parsed.data,
  });
};
