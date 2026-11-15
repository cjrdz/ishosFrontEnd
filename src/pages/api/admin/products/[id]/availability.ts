/**
 * PATCH /api/admin/products/{id}/availability - Flip a product's availability
 *
 * Open to staff as well as admins (sold-out items during service); the
 * backend enforces the same rule. No request body.
 */

import type { APIRoute } from "astro";
import { requireUuidParam } from "@core/bff/params";
import { proxyToBackend } from "@core/bff/proxy";

export const prerender = false;

export const PATCH: APIRoute = async (context) => {
  const id = requireUuidParam(context, "id");
  if (id instanceof Response) return id;
  return proxyToBackend(context, `/products/${id}/availability`, {
    method: "PATCH",
  });
};
