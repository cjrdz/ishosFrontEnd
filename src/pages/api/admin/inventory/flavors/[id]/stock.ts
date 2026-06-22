/**
 * GET /api/admin/inventory/flavors/{id}/stock
 *
 * Backend forwarding endpoint for flavor stock status
 * Requires: auth_token HttpOnly cookie
 */

import type { APIRoute } from "astro";
import { requireUuidParam } from "@core/bff/params";
import { proxyToBackend } from "@core/bff/proxy";

export const prerender = false;

export const GET: APIRoute = async (context) => {
  const id = requireUuidParam(context, "id");
  if (id instanceof Response) return id;
  return proxyToBackend(context, `/inventory/flavors/${id}/stock`);
};
