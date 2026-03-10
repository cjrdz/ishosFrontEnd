/**
 * GET /api/store/tracking/{orderNumber}
 *
 * Public endpoint for tracking orders
 * No authentication required
 */

import type { APIRoute } from 'astro';
import { getApiBaseUrl } from '../../../../lib/config';

export const prerender = false;

export const GET: APIRoute = async (context) => {
  const { orderNumber } = context.params;

  try {
    const response = await fetch(`${getApiBaseUrl()}/orders/${orderNumber}`);
    const data = await response.json();

    return new Response(JSON.stringify(data), {
      status: response.status,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    return new Response(
      JSON.stringify({ error: 'Order not found' }),
      { status: 404, headers: { 'Content-Type': 'application/json' } }
    );
  }
};
