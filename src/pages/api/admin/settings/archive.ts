/**
 * GET  /api/admin/settings/archive — Read order archive config
 * PATCH /api/admin/settings/archive — Update order archive config
 */

import type { APIRoute } from "astro";
import { archiveConfigUpdateSchema, parseJsonBody } from "@core/bff/validation";
import { proxyToBackend } from "@core/bff/proxy";

export const prerender = false;

export const GET: APIRoute = async (context) => {
  return proxyToBackend(context, "/settings/archive");
};

export const PATCH: APIRoute = async (context) => {
  const parsed = await parseJsonBody(context, archiveConfigUpdateSchema);
  if (!parsed.success) {
    return parsed.response;
  }

  return proxyToBackend(context, "/settings/archive", {
    method: "PATCH",
    body: parsed.data,
  });
};
