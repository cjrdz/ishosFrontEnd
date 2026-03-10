/**
 * POST /api/store/orders
 *
 * Public endpoint for creating orders (customer-facing)
 * No authentication required
 */

import type { APIRoute } from 'astro';
import { getApiBaseUrl } from '../../../lib/config';

export const prerender = false;

export const POST: APIRoute = async (context) => {
  try {
    const body = await context.request.json();

    const response = await fetch(`${getApiBaseUrl()}/orders`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    const data = await response.json();

    return new Response(JSON.stringify(data), {
      status: response.status,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    return new Response(
      JSON.stringify({ error: 'Failed to create order' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
};
