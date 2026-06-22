/**
 * GET /api/admin/inventory/low-stock
 *
 * Backend forwarding endpoint for low stock items
 * Requires: auth_token HttpOnly cookie
 */

import type { APIRoute } from "astro";
import { proxyToBackend } from "@core/bff/proxy";

export const prerender = false;

export const GET: APIRoute = async (context) => {
  return proxyToBackend(context, "/inventory/low-stock");
};
