/**
 * GET /api/admin/inventory/stats
 *
 * Backend forwarding endpoint for inventory statistics
 * Requires: auth_token HttpOnly cookie
 */

import type { APIRoute } from "astro";
import { proxyToBackend } from "@core/bff/proxy";

export const prerender = false;

export const GET: APIRoute = async (context) => {
  return proxyToBackend(context, "/inventory/stats");
};
