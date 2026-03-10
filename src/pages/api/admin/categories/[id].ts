/**
 * PATCH /api/admin/categories/{id} - Update category
 * DELETE /api/admin/categories/{id} - Delete category
 *
 * Backend forwarding endpoints for specific category operations
 * Requires: auth_token HttpOnly cookie
 */

import type { APIRoute } from 'astro';
import { proxyToBackend } from '../../../../lib/bff/proxy';

export const prerender = false;

export const PATCH: APIRoute = async (context) => {
  const { id } = context.params;
  try {
    const body = await context.request.json();
    return proxyToBackend(context, `/categories/${id}`, {
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
  return proxyToBackend(context, `/categories/${id}`, { method: 'DELETE' });
};
