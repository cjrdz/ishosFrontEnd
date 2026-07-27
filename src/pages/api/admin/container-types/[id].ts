/**
 * GET /api/admin/container-types/{id}
 * PATCH /api/admin/container-types/{id}
 * DELETE /api/admin/container-types/{id}
 *
 * Backend forwarding endpoints for specific container type operations
 * Requires: auth_token HttpOnly cookie
 */

import type { APIRoute } from "astro";
import { containerTypeUpdateSchema, parseJsonBody } from "@core/bff/validation";
import { requireUuidParam } from "@core/bff/params";
import { proxyToBackend } from "@core/bff/proxy";

export const prerender = false;

export const GET: APIRoute = async (context) => {
  const id = requireUuidParam(context, "id");
  if (id instanceof Response) return id;
  return proxyToBackend(context, `/container-types/${id}`);
};

export const PATCH: APIRoute = async (context) => {
  const id = requireUuidParam(context, "id");
  if (id instanceof Response) return id;

  const parsed = await parseJsonBody(context, containerTypeUpdateSchema);
  if (!parsed.success) {
    return parsed.response;
  }

  return proxyToBackend(context, `/container-types/${id}`, {
    method: "PATCH",
    body: parsed.data,
  });
};

export const DELETE: APIRoute = async (context) => {
  const id = requireUuidParam(context, "id");
  if (id instanceof Response) return id;
  return proxyToBackend(context, `/container-types/${id}`, {
    method: "DELETE",
  });
};
