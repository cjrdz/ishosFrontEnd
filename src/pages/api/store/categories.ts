/**
 * GET /api/store/categories
 *
 * Public endpoint for fetching categories
 * No authentication required
 */

import type { APIRoute } from 'astro';
import { forwardUpstreamJson, getServerApiBaseUrl } from '../../../lib/bff/proxy';

export const prerender = false;

export const GET: APIRoute = async (context) => {
  try {
    const response = await fetch(`${getServerApiBaseUrl(context)}/categories`);
    return forwardUpstreamJson(response);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('[store/categories] upstream fetch failed:', message);
    return new Response(
      JSON.stringify({ error: 'Failed to fetch categories', detail: message }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
};
