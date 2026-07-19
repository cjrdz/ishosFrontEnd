/**
 * POST /api/admin/inventory/{id}/entries
 *
 * Backend forwarding endpoint for recording inventory entry
 * Requires: auth_token HttpOnly cookie
 */

import type { APIRoute } from "astro";
import { inventoryEntrySchema, parseJsonBody } from "@core/bff/validation";
import { requireUuidParam } from "@core/bff/params";
import { proxyToBackend } from "@core/bff/proxy";

export const prerender = false;

export const POST: APIRoute = async (context) => {
  const id = requireUuidParam(context, "id");
  if (id instanceof Response) return id;

  const parsed = await parseJsonBody(context, inventoryEntrySchema);
  if (!parsed.success) {
    return parsed.response;
  }

  return proxyToBackend(context, `/inventory/${id}/entries`, {
    method: "POST",
    body: parsed.data,
  });
};
