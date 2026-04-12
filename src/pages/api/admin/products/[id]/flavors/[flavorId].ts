/**
 * POST /api/admin/products/{id}/flavors/{flavorId} - Link flavor to product
 * DELETE /api/admin/products/{id}/flavors/{flavorId} - Unlink flavor from product
 *
 * Backend forwarding endpoints for product-flavor linking
 * Requires: auth_token HttpOnly cookie
 */

import type { APIRoute } from 'astro';
import { requireUuidParam } from '../../../../../../lib/bff/params';
import { proxyToBackend } from '../../../../../../lib/bff/proxy';

export const prerender = false;

export const POST: APIRoute = async (context) => {
  const id = requireUuidParam(context, 'id');
  if (id instanceof Response) return id;
  const flavorId = requireUuidParam(context, 'flavorId');
  if (flavorId instanceof Response) return flavorId;
  return proxyToBackend(context, `/products/${id}/flavors/${flavorId}`, {
    method: 'POST',
  });
};

export const DELETE: APIRoute = async (context) => {
  const id = requireUuidParam(context, 'id');
  if (id instanceof Response) return id;
  const flavorId = requireUuidParam(context, 'flavorId');
  if (flavorId instanceof Response) return flavorId;
  return proxyToBackend(context, `/products/${id}/flavors/${flavorId}`, {
    method: 'DELETE',
  });
};
