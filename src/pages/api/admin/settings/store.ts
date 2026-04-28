/**
 * GET  /api/admin/settings/store — Read full store settings (admin-auth)
 * PATCH /api/admin/settings/store — Update store settings (admin-auth)
 */

import type { APIRoute } from "astro";
import { proxyToBackend } from "@core/bff/proxy";

export const prerender = false;

export const GET: APIRoute = async (context) => {
  return proxyToBackend(context, "/settings/store");
};

export const PATCH: APIRoute = async (context) => {
  const body = await context.request.json();
  return proxyToBackend(context, "/settings/store", {
    method: "PATCH",
    body,
  });
};
