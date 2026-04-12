import type { APIRoute } from 'astro';
import { proxyToBackend } from '../../../../lib/bff/proxy';

export const prerender = false;

export const GET: APIRoute = async (context) => {
  return proxyToBackend(context, '/settings/tabs');
};

export const PATCH: APIRoute = async (context) => {
  try {
    const body = await context.request.json();
    return proxyToBackend(context, '/settings/tabs', {
      method: 'PATCH',
      body,
    });
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid request body' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};
