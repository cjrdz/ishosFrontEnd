/**
 * GET /api/admin/orders/{id}
 * PATCH /api/admin/orders/{id} - Update order
 * DELETE /api/admin/orders/{id} - Delete order (admin only)
 * POST /api/admin/orders/{id}?action=approve - Approve order
 * POST /api/admin/orders/{id}?action=reject - Reject order
 * POST /api/admin/orders/{id}?action=status - Update status
 * POST /api/admin/orders/{id}?action=notes - Update notes
 *
 * Backend forwarding endpoints for specific order operations
 * Requires: auth_token HttpOnly cookie
 */

import type { APIRoute } from "astro";
import {
  orderApproveSchema,
  orderNotesSchema,
  orderRejectSchema,
  orderStatusSchema,
  orderUpdateSchema,
  parseJsonBody,
} from "@core/bff/validation";
import { requireAction, requireUuidParam } from "@core/bff/params";
import { proxyToBackend } from "@core/bff/proxy";
import { requireAdmin } from "@core/bff/guards";

export const prerender = false;

export const GET: APIRoute = async (context) => {
  const id = requireUuidParam(context, "id");
  if (id instanceof Response) return id;
  return proxyToBackend(context, `/orders/${id}`);
};

export const PATCH: APIRoute = async (context) => {
  const id = requireUuidParam(context, "id");
  if (id instanceof Response) return id;

  const action = context.url.searchParams.get("action")?.trim() ?? "";
  if (action && action !== "status" && action !== "notes") {
    return new Response(
      JSON.stringify({
        error: "Invalid action query parameter",
        code: "VALIDATION_ERROR",
      }),
      { status: 400, headers: { "Content-Type": "application/json" } },
    );
  }

  const schema =
    action === "status"
      ? orderStatusSchema
      : action === "notes"
        ? orderNotesSchema
        : orderUpdateSchema;
  const parsed = await parseJsonBody(context, schema);
  if (!parsed.success) {
    return parsed.response;
  }

  const targetPath =
    action === "status"
      ? `/orders/${id}/status`
      : action === "notes"
        ? `/orders/${id}/notes`
        : `/orders/${id}`;

  return proxyToBackend(context, targetPath, {
    method: "PATCH",
    body: parsed.data,
  });
};

export const DELETE: APIRoute = async (context) => {
  const adminError = requireAdmin(context);
  if (adminError) return adminError;

  const id = requireUuidParam(context, "id");
  if (id instanceof Response) return id;
  return proxyToBackend(context, `/orders/${id}`, { method: "DELETE" });
};

export const POST: APIRoute = async (context) => {
  const id = requireUuidParam(context, "id");
  if (id instanceof Response) return id;

  const action = requireAction(context.url.searchParams.get("action"), [
    "approve",
    "reject",
  ]);
  if (action instanceof Response) return action;

  const schema = action === "reject" ? orderRejectSchema : orderApproveSchema;
  const parsed = await parseJsonBody(context, schema);
  if (!parsed.success) {
    return parsed.response;
  }

  return proxyToBackend(context, `/orders/${id}/${action}`, {
    method: "POST",
    body: parsed.data,
  });
};
