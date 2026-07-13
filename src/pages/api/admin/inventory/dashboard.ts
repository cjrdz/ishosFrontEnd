/**
 * GET /api/admin/inventory/dashboard
 *
 * Returns flavor inventory, unit inventory and stats in a single response.
 * Requires: auth_token HttpOnly cookie
 */

import type { APIRoute } from "astro";
import { proxyToBackend } from "@core/bff/proxy";

export const prerender = false;

export const GET: APIRoute = async (context) => {
  return proxyToBackend(context, "/inventory/dashboard");
};
