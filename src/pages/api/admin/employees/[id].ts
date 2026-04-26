/**
 * PATCH /api/admin/employees/{id} - Update employee
 * DELETE /api/admin/employees/{id} - Delete employee
 * POST /api/admin/employees/{id}?action=deactivate - Deactivate employee
 *
 * Backend forwarding endpoints for specific employee operations
 * Requires: auth_token HttpOnly cookie
 */

import type { APIRoute } from "astro";
import {
  requireAction,
  requireSafePathParam,
} from "../../../../lib/bff/params";
import { proxyToBackend } from "../../../../lib/bff/proxy";

export const prerender = false;

export const PATCH: APIRoute = async (context) => {
  const id = requireSafePathParam(context, "id");
  if (id instanceof Response) return id;
  try {
    const body = await context.request.json();
    return proxyToBackend(context, `/employees/${id}`, {
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
  const id = requireSafePathParam(context, "id");
  if (id instanceof Response) return id;
  const action = context.url.searchParams.get("action");

  if (action === "deactivate") {
    return proxyToBackend(context, `/employees/${id}/deactivate`, {
      method: "POST",
    });
  }

  return proxyToBackend(context, `/employees/${id}`, { method: "DELETE" });
};

export const POST: APIRoute = async (context) => {
  const id = requireSafePathParam(context, "id");
  if (id instanceof Response) return id;
  const action = requireAction(context.url.searchParams.get("action"), [
    "deactivate",
  ]);
  if (action instanceof Response) return action;

  try {
    const body = await context.request.json().catch(() => ({}));
    return proxyToBackend(context, `/employees/${id}/${action}`, {
      method: "POST",
      body,
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: "Invalid request" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }
};
