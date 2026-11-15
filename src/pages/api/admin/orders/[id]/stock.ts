/**
 * GET /api/admin/orders/{id}/stock
 *
 * What an order took from inventory and still holds, so cancelling it can
 * choose what goes back to stock. Admins and managers (backend enforces it).
 */

import type { APIRoute } from "astro";
import { requireUuidParam } from "@core/bff/params";
import { proxyToBackend } from "@core/bff/proxy";
import { requireRole } from "@core/bff/guards";

export const prerender = false;

export const GET: APIRoute = async (context) => {
  const roleError = requireRole(context, ["admin", "manager"]);
  if (roleError) return roleError;

  const id = requireUuidParam(context, "id");
  if (id instanceof Response) return id;

  return proxyToBackend(context, `/orders/${id}/stock`);
};
