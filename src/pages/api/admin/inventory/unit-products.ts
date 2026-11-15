/**
 * POST /api/admin/inventory/unit-products
 *
 * Starts tracking a unit product (paletas, bebidas…) at every location with
 * zero stock. Admin only (the backend enforces it too).
 */

import type { APIRoute } from "astro";
import {
  inventoryUnitProductSchema,
  parseJsonBody,
} from "@core/bff/validation";
import { proxyToBackend } from "@core/bff/proxy";
import { requireAdmin } from "@core/bff/guards";

export const prerender = false;

export const POST: APIRoute = async (context) => {
  const adminError = requireAdmin(context);
  if (adminError) return adminError;

  const parsed = await parseJsonBody(context, inventoryUnitProductSchema);
  if (!parsed.success) return parsed.response;

  return proxyToBackend(context, "/inventory/unit-products", {
    method: "POST",
    body: parsed.data,
  });
};
