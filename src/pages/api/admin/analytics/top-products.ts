import type { APIRoute } from 'astro';
import { proxyToBackend } from '../../../../lib/bff/proxy';

export const prerender = false;

export const GET: APIRoute = async (context) => {
  const limit = context.url.searchParams.get('limit') || '10';
  return proxyToBackend(context, '/analytics/top-products', {
    query: { limit },
  });
};
