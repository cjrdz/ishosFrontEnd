/**
 * PATCH /api/admin/inventory/{id}
 *
 * Sets an inventory item's minimum ("Stock bajo" below it). Admins and
 * managers (their own location; the backend checks the scope).
 */

import type { APIRoute } from "astro";
import { inventoryThresholdSchema, parseJsonBody } from "@core/bff/validation";
import { requireUuidParam } from "@core/bff/params";
import { proxyToBackend } from "@core/bff/proxy";

export const prerender = false;

export const PATCH: APIRoute = async (context) => {
  const id = requireUuidParam(context, "id");
  if (id instanceof Response) return id;

  const parsed = await parseJsonBody(context, inventoryThresholdSchema);
  if (!parsed.success) return parsed.response;

  return proxyToBackend(context, `/inventory/${id}`, {
    method: "PATCH",
    body: parsed.data,
  });
};
