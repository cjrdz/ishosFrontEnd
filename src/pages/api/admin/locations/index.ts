/**
 * GET  /api/admin/locations — Locations the signed-in user works with
 *                             (all for admins, their own for staff)
 * POST /api/admin/locations — Add a location (admin only)
 */

import type { APIRoute } from "astro";
import { locationCreateSchema, parseJsonBody } from "@core/bff/validation";
import { proxyToBackend } from "@core/bff/proxy";
import { requireAdmin } from "@core/bff/guards";

export const prerender = false;

export const GET: APIRoute = async (context) => {
  return proxyToBackend(context, "/locations/manage");
};

export const POST: APIRoute = async (context) => {
  const adminError = requireAdmin(context);
  if (adminError) return adminError;

  const parsed = await parseJsonBody(context, locationCreateSchema);
  if (!parsed.success) return parsed.response;

  return proxyToBackend(context, "/locations", {
    method: "POST",
    body: parsed.data,
  });
};
