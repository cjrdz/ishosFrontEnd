/**
 * GET /api/admin/flavors/{id}
 * PATCH /api/admin/flavors/{id} - Update flavor
 * DELETE /api/admin/flavors/{id} - Delete flavor
 *
 * Backend forwarding endpoints for specific flavor operations
 * Requires: auth_token HttpOnly cookie
 */

import type { APIRoute } from 'astro';
import { proxyToBackend } from '../../../../lib/bff/proxy';

export const prerender = false;

export const GET: APIRoute = async (context) => {
  const { id } = context.params;
  return proxyToBackend(context, `/flavors/${id}`);
};

export const PATCH: APIRoute = async (context) => {
  const { id } = context.params;
  try {
    const body = await context.request.json();
    return proxyToBackend(context, `/flavors/${id}`, {
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
  return proxyToBackend(context, `/flavors/${id}`, { method: 'DELETE' });
};
