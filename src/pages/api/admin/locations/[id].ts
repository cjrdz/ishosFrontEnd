/**
 * PATCH /api/admin/locations/{id} — Update a location.
 *
 * Admins may change everything; a manager only the hours and the orders
 * switch of their own location (enforced by the backend).
 */

import type { APIRoute } from "astro";
import { requireUuidParam } from "@core/bff/params";
import { locationUpdateSchema, parseJsonBody } from "@core/bff/validation";
import { proxyToBackend } from "@core/bff/proxy";
import { requireRole } from "@core/bff/guards";

export const prerender = false;

export const PATCH: APIRoute = async (context) => {
  const roleError = requireRole(context, ["admin", "manager"]);
  if (roleError) return roleError;

  const id = requireUuidParam(context, "id");
  if (id instanceof Response) return id;

  const parsed = await parseJsonBody(context, locationUpdateSchema);
  if (!parsed.success) return parsed.response;

  return proxyToBackend(context, `/locations/${id}`, {
    method: "PATCH",
    body: parsed.data,
  });
};
