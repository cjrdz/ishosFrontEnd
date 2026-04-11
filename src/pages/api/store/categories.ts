/**
 * GET /api/store/categories
 *
 * Public endpoint for fetching categories
 * No authentication required
 */

import type { APIRoute } from 'astro';
import { getApiBaseUrl } from '../../../lib/config';

export const prerender = false;

export const GET: APIRoute = async () => {
  try {
    const response = await fetch(`${getApiBaseUrl()}/categories`);
    const data = await response.json();

    return new Response(JSON.stringify(data), {
      status: response.status,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch {
    return new Response(
      JSON.stringify({ error: 'Failed to fetch categories' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
};
