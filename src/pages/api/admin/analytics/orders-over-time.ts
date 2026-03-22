import type { APIRoute } from 'astro';
import { proxyToBackend } from '../../../../lib/bff/proxy';

export const prerender = false;

export const GET: APIRoute = async (context) => {
  const start = context.url.searchParams.get('start') || '';
  const end = context.url.searchParams.get('end') || '';
  const groupBy = context.url.searchParams.get('groupBy') || 'day';

  const query: Record<string, string> = { groupBy };
  if (start) query.start = start;
  if (end) query.end = end;

  return proxyToBackend(context, '/analytics/orders-over-time', { query });
};
