/**
 * GET /api/admin/container-types/{id}
 * PATCH /api/admin/container-types/{id}
 * DELETE /api/admin/container-types/{id}
 *
 * Backend forwarding endpoints for specific container type operations
 * Requires: auth_token HttpOnly cookie
 */

import type { APIRoute } from "astro";
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
  try {
    const body = await context.request.json();
    return proxyToBackend(context, `/container-types/${id}`, {
      method: "PATCH",
      body,
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: "Invalid request body" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }
};

export const DELETE: APIRoute = async (context) => {
  const id = requireUuidParam(context, "id");
  if (id instanceof Response) return id;
  return proxyToBackend(context, `/container-types/${id}`, {
    method: "DELETE",
  });
};
