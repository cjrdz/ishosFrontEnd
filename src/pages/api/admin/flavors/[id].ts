/**
 * GET /api/admin/flavors/{id}
 * PATCH /api/admin/flavors/{id} - Update flavor
 * DELETE /api/admin/flavors/{id} - Delete flavor
 *
 * Backend forwarding endpoints for specific flavor operations
 * Requires: auth_token HttpOnly cookie
 */

import type { APIRoute } from "astro";
import { flavorUpdateSchema, parseJsonBody } from "@core/bff/validation";
import { requireUuidParam } from "@core/bff/params";
import { proxyToBackend } from "@core/bff/proxy";
import { requireAdmin } from "@core/bff/guards";

export const prerender = false;

export const GET: APIRoute = async (context) => {
  const id = requireUuidParam(context, "id");
  if (id instanceof Response) return id;
  return proxyToBackend(context, `/flavors/${id}`);
};

export const PATCH: APIRoute = async (context) => {
  const id = requireUuidParam(context, "id");
  if (id instanceof Response) return id;

  const parsed = await parseJsonBody(context, flavorUpdateSchema);
  if (!parsed.success) {
    return parsed.response;
  }

  return proxyToBackend(context, `/flavors/${id}`, {
    method: "PATCH",
    body: parsed.data,
  });
};

export const DELETE: APIRoute = async (context) => {
  const adminError = requireAdmin(context);
  if (adminError) return adminError;

  const id = requireUuidParam(context, "id");
  if (id instanceof Response) return id;
  return proxyToBackend(context, `/flavors/${id}`, { method: "DELETE" });
};
