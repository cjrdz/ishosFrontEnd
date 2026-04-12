/**
 * GET /api/admin/orders/{id}
 * PATCH /api/admin/orders/{id} - Update order
 * DELETE /api/admin/orders/{id} - Delete order (admin only)
 * POST /api/admin/orders/{id}?action=approve - Approve order
 * POST /api/admin/orders/{id}?action=reject - Reject order
 * POST /api/admin/orders/{id}?action=status - Update status
 * POST /api/admin/orders/{id}?action=notes - Update notes
 *
 * Backend forwarding endpoints for specific order operations
 * Requires: auth_token HttpOnly cookie
 */

import type { APIRoute } from 'astro';
import { requireAction, requireUuidParam } from '../../../../lib/bff/params';
import { proxyToBackend } from '../../../../lib/bff/proxy';

export const prerender = false;

export const GET: APIRoute = async (context) => {
  const id = requireUuidParam(context, 'id');
  if (id instanceof Response) return id;
  return proxyToBackend(context, `/orders/${id}`);
};

export const PATCH: APIRoute = async (context) => {
  const id = requireUuidParam(context, 'id');
  if (id instanceof Response) return id;
  const action = context.url.searchParams.get('action')?.trim() ?? '';
  if (action && action !== 'status' && action !== 'notes') {
    return new Response(
      JSON.stringify({ error: 'Invalid action query parameter', code: 'VALIDATION_ERROR' }),
      { status: 400, headers: { 'Content-Type': 'application/json' } }
    );
  }
  try {
    const body = await context.request.json();
    const targetPath =
      action === 'status'
        ? `/orders/${id}/status`
        : action === 'notes'
          ? `/orders/${id}/notes`
          : `/orders/${id}`;

    return proxyToBackend(context, targetPath, {
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
  const id = requireUuidParam(context, 'id');
  if (id instanceof Response) return id;
  return proxyToBackend(context, `/orders/${id}`, { method: 'DELETE' });
};

export const POST: APIRoute = async (context) => {
  const id = requireUuidParam(context, 'id');
  if (id instanceof Response) return id;
  const action = requireAction(context.url.searchParams.get('action'), ['approve', 'reject']);
  if (action instanceof Response) return action;

  try {
    const body = await context.request.json().catch(() => ({}));
    return proxyToBackend(context, `/orders/${id}/${action}`, {
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
