/**
 * GET /api/store/products
 * GET /api/store/products?category=electronics
 *
 * Public endpoint for fetching products
 * No authentication required
 */

import type { APIRoute } from 'astro';
import { forwardUpstreamJson, getServerApiBaseUrl } from '../../../lib/bff/proxy';

export const prerender = false;

export const GET: APIRoute = async (context) => {
  const category = context.url.searchParams.get('category') || '';

  try {
    const url = new URL(`${getServerApiBaseUrl(context)}/products`);
    if (category) {
      url.searchParams.set('category', category);
    }

    const response = await fetch(url.toString());
    return forwardUpstreamJson(response);
  } catch (error) {
    return new Response(
      JSON.stringify({ error: 'Failed to fetch products' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
};
