/**
 * GET /api/admin/settings/hours — Weekly opening hours (admin and staff)
 * PUT /api/admin/settings/hours — Replace the schedule (admin only)
 */

import type { APIRoute } from "astro";
import { parseJsonBody, storeHoursUpdateSchema } from "@core/bff/validation";
import { proxyToBackend } from "@core/bff/proxy";
import { requireAdmin } from "@core/bff/guards";

export const prerender = false;

export const GET: APIRoute = async (context) => {
  return proxyToBackend(context, "/settings/hours");
};

export const PUT: APIRoute = async (context) => {
  const adminError = requireAdmin(context);
  if (adminError) return adminError;

  const parsed = await parseJsonBody(context, storeHoursUpdateSchema);
  if (!parsed.success) {
    return parsed.response;
  }

  return proxyToBackend(context, "/settings/hours", {
    method: "PUT",
    body: parsed.data,
  });
};
