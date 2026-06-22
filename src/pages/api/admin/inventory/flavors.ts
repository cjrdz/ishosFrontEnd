/**
 * GET /api/admin/inventory/flavors
 *
 * Backend forwarding endpoint for flavor inventory list
 * Requires: auth_token HttpOnly cookie
 */

import type { APIRoute } from "astro";
import { proxyToBackend } from "@core/bff/proxy";

export const prerender = false;

export const GET: APIRoute = async (context) => {
  return proxyToBackend(context, "/inventory/flavors");
};
