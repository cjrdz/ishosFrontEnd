/**
 * GET /api/admin/inventory/{id}/movements
 *
 * Backend forwarding endpoint for inventory movement history
 * Requires: auth_token HttpOnly cookie
 */

import type { APIRoute } from "astro";
import { requireUuidParam } from "@core/bff/params";
import { proxyToBackend } from "@core/bff/proxy";

export const prerender = false;

export const GET: APIRoute = async (context) => {
  const id = requireUuidParam(context, "id");
  if (id instanceof Response) return id;

  const limit = context.url.searchParams.get("limit") ?? "50";
  const offset = context.url.searchParams.get("offset") ?? "0";

  return proxyToBackend(context, `/inventory/${id}/movements`, {
    query: { limit, offset },
  });
};
