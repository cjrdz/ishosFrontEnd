/**
 * GET /api/admin/container-types
 * POST /api/admin/container-types
 *
 * Backend forwarding endpoints for container type operations
 * Requires: auth_token HttpOnly cookie
 */

import type { APIRoute } from "astro";
import { containerTypeCreateSchema, parseJsonBody } from "@core/bff/validation";
import { proxyToBackend } from "@core/bff/proxy";

export const prerender = false;

export const GET: APIRoute = async (context) => {
  return proxyToBackend(context, "/container-types");
};

export const POST: APIRoute = async (context) => {
  const parsed = await parseJsonBody(context, containerTypeCreateSchema);
  if (!parsed.success) {
    return parsed.response;
  }

  return proxyToBackend(context, "/container-types", {
    method: "POST",
    body: parsed.data,
  });
};
