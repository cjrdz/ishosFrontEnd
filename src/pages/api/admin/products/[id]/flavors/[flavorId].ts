/**
 * POST /api/admin/products/{id}/flavors/{flavorId} - Link flavor to product
 * DELETE /api/admin/products/{id}/flavors/{flavorId} - Unlink flavor from product
 *
 * Backend forwarding endpoints for product-flavor linking
 * Requires: auth_token HttpOnly cookie
 */

import type { APIRoute } from "astro";
import { requireUuidParam } from "@core/bff/params";
import { proxyToBackend } from "@core/bff/proxy";
import { requireAdmin } from "@core/bff/guards";

export const prerender = false;

export const POST: APIRoute = async (context) => {
  // Catalog changes are admin-only (the backend enforces it too).
  const adminError = requireAdmin(context);
  if (adminError) return adminError;
  const id = requireUuidParam(context, "id");
  if (id instanceof Response) return id;
  const flavorId = requireUuidParam(context, "flavorId");
  if (flavorId instanceof Response) return flavorId;
  return proxyToBackend(context, `/products/${id}/flavors/${flavorId}`, {
    method: "POST",
  });
};

export const DELETE: APIRoute = async (context) => {
  // Catalog changes are admin-only (the backend enforces it too).
  const adminError = requireAdmin(context);
  if (adminError) return adminError;
  const id = requireUuidParam(context, "id");
  if (id instanceof Response) return id;
  const flavorId = requireUuidParam(context, "flavorId");
  if (flavorId instanceof Response) return flavorId;
  return proxyToBackend(context, `/products/${id}/flavors/${flavorId}`, {
    method: "DELETE",
  });
};
