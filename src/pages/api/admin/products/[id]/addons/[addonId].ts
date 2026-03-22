/**
 * POST /api/admin/products/{id}/addons/{addonId} - Link addon to product
 * DELETE /api/admin/products/{id}/addons/{addonId} - Unlink addon from product
 *
 * Backend forwarding endpoints for product-addon linking
 * Requires: auth_token HttpOnly cookie
 */

import type { APIRoute } from 'astro';
import { proxyToBackend } from '../../../../../../lib/bff/proxy';

export const prerender = false;

export const POST: APIRoute = async (context) => {
  const { id, addonId } = context.params;
  return proxyToBackend(context, `/products/${id}/addons/${addonId}`, {
    method: 'POST',
  });
};

export const DELETE: APIRoute = async (context) => {
  const { id, addonId } = context.params;
  return proxyToBackend(context, `/products/${id}/addons/${addonId}`, {
    method: 'DELETE',
  });
};
