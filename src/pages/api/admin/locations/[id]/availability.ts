/**
 * GET /api/admin/locations/{id}/availability — Products and flavours sold
 *     out ("Agotados") at a location
 * PUT /api/admin/locations/{id}/availability — Mark one sold out / available
 *
 * Any staff member may change their own location; the backend refuses other
 * locations.
 */

import type { APIRoute } from "astro";
import { requireUuidParam } from "@core/bff/params";
import {
  locationAvailabilitySchema,
  parseJsonBody,
} from "@core/bff/validation";
import { proxyToBackend } from "@core/bff/proxy";

export const prerender = false;

export const GET: APIRoute = async (context) => {
  const id = requireUuidParam(context, "id");
  if (id instanceof Response) return id;
  return proxyToBackend(context, `/locations/${id}/availability`);
};

export const PUT: APIRoute = async (context) => {
  const id = requireUuidParam(context, "id");
  if (id instanceof Response) return id;

  const parsed = await parseJsonBody(context, locationAvailabilitySchema);
  if (!parsed.success) return parsed.response;

  return proxyToBackend(context, `/locations/${id}/availability`, {
    method: "PUT",
    body: parsed.data,
  });
};
