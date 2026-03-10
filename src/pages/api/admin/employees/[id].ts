/**
 * PATCH /api/admin/employees/{id} - Update employee
 * DELETE /api/admin/employees/{id} - Delete employee
 * POST /api/admin/employees/{id}?action=deactivate - Deactivate employee
 *
 * Backend forwarding endpoints for specific employee operations
 * Requires: auth_token HttpOnly cookie
 */

import type { APIRoute } from 'astro';
import { proxyToBackend } from '../../../../lib/bff/proxy';

export const prerender = false;

export const PATCH: APIRoute = async (context) => {
  const { id } = context.params;
  try {
    const body = await context.request.json();
    return proxyToBackend(context, `/employees/${id}`, {
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
  const action = context.url.searchParams.get('action');

  if (action === 'deactivate') {
    return proxyToBackend(context, `/employees/${id}/deactivate`, {
      method: 'POST',
    });
  }

  return proxyToBackend(context, `/employees/${id}`, { method: 'DELETE' });
};

export const POST: APIRoute = async (context) => {
  const { id } = context.params;
  const action = context.url.searchParams.get('action');

  if (!action) {
    return new Response(
      JSON.stringify({ error: 'Missing action query parameter' }),
      { status: 400, headers: { 'Content-Type': 'application/json' } }
    );
  }

  try {
    const body = await context.request.json().catch(() => ({}));
    return proxyToBackend(context, `/employees/${id}/${action}`, {
      method: 'POST',
      body,
    });
  } catch (error) {
    return new Response(
      JSON.stringify({ error: 'Invalid request' }),
      { status: 400, headers: { 'Content-Type': 'application/json' } }
    );
  }
};
