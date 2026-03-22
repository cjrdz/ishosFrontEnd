/**
 * POST /api/admin/products/{id}/flavors/{flavorId} - Link flavor to product
 * DELETE /api/admin/products/{id}/flavors/{flavorId} - Unlink flavor from product
 *
 * Backend forwarding endpoints for product-flavor linking
 * Requires: auth_token HttpOnly cookie
 */

import type { APIRoute } from 'astro';
import { proxyToBackend } from '../../../../../../lib/bff/proxy';

export const prerender = false;

export const POST: APIRoute = async (context) => {
  const { id, flavorId } = context.params;
  return proxyToBackend(context, `/products/${id}/flavors/${flavorId}`, {
    method: 'POST',
  });
};

export const DELETE: APIRoute = async (context) => {
  const { id, flavorId } = context.params;
  return proxyToBackend(context, `/products/${id}/flavors/${flavorId}`, {
    method: 'DELETE',
  });
};
