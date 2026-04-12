/**
 * GET /api/admin/images
 * POST /api/admin/images - Upload image
 * DELETE /api/admin/images - Delete image
 *
 * Backend forwarding endpoints for image/upload operations
 * Requires: auth_token HttpOnly cookie
 */

import type { APIRoute } from 'astro';
import { proxyToBackend } from '../../../../lib/bff/proxy';
import { getApiBaseUrl } from '../../../../lib/config';

export const prerender = false;

export const GET: APIRoute = async (context) => {
  return proxyToBackend(context, '/upload/images');
};

export const POST: APIRoute = async (context) => {
  const token = context.cookies.get('auth_token')?.value;

  if (!token) {
    return new Response(
      JSON.stringify({ error: 'Unauthorized' }),
      { status: 401, headers: { 'Content-Type': 'application/json' } }
    );
  }

  try {
    const formData = await context.request.formData();

    const response = await fetch(`${getApiBaseUrl()}/upload/image`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
      },
      body: formData,
    });

    const data = await response.json();

    return new Response(JSON.stringify(data), {
      status: response.status,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Image upload error:', error);
    return new Response(
      JSON.stringify({ error: 'Upload failed' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
};

export const DELETE: APIRoute = async (context) => {
  try {
    const body = await context.request.json();
    return proxyToBackend(context, '/upload/image', {
      method: 'DELETE',
      body,
    });
  } catch (error) {
    return new Response(
      JSON.stringify({ error: 'Invalid request body' }),
      { status: 400, headers: { 'Content-Type': 'application/json' } }
    );
  }
};
