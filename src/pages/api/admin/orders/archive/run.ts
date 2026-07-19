/**
 * POST /api/admin/orders/archive/run
 *
 * Trigger an immediate order archive pass.
 * Requires: auth_token HttpOnly cookie, admin role (enforced by backend).
 */

import type { APIRoute } from "astro";
import { proxyToBackend } from "@core/bff/proxy";
import { requireAdmin } from "@core/bff/guards";

export const prerender = false;

export const POST: APIRoute = async (context) => {
  const adminError = requireAdmin(context);
  if (adminError) return adminError;

  return proxyToBackend(context, "/admin/orders/archive/run", {
    method: "POST",
    body: {},
  });
};
