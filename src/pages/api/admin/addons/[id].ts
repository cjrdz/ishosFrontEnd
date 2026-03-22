/**
 * GET /api/admin/addons/{id}
 * PATCH /api/admin/addons/{id} - Update addon
 * DELETE /api/admin/addons/{id} - Delete addon
 *
 * Backend forwarding endpoints for specific addon operations
 * Requires: auth_token HttpOnly cookie
 */

import type { APIRoute } from 'astro';
import { proxyToBackend } from '../../../../lib/bff/proxy';

export const prerender = false;

export const GET: APIRoute = async (context) => {
  const { id } = context.params;
  return proxyToBackend(context, `/addons/${id}`);
};

export const PATCH: APIRoute = async (context) => {
  const { id } = context.params;
  try {
    const body = await context.request.json();
    return proxyToBackend(context, `/addons/${id}`, {
      method: 'PATCH',
      body,
    });
  } catch (error) {
    return new Response(
      JSON.stringify({ error: 'Invalid request body' }),
      { status: 400, headers: { 'Content-Type': 'application/json' } }
    );
  }
};

export const DELETE: APIRoute = async (context) => {
  const { id } = context.params;
  return proxyToBackend(context, `/addons/${id}`, { method: 'DELETE' });
};
