/**
 * GET /api/store/tracking/{orderNumber}
 *
 * Public endpoint for tracking orders
 * No authentication required
 */

import type { APIRoute } from 'astro';
import { getApiBaseUrl } from '../../../../lib/config';

const ORDER_NUMBER_RE = /^ORD-\d{8}-\d{4}$/;

export const prerender = false;

export const GET: APIRoute = async (context) => {
  const { orderNumber } = context.params;
  const trackingToken = context.url.searchParams.get('tracking_token')?.trim() ?? '';

  if (!orderNumber || !trackingToken) {
    return new Response(
      JSON.stringify({ error: 'orderNumber and tracking_token are required' }),
      { status: 400, headers: { 'Content-Type': 'application/json' } }
    );
  }

  if (!ORDER_NUMBER_RE.test(orderNumber)) {
    return new Response(
      JSON.stringify({ error: 'Invalid order number format' }),
      { status: 400, headers: { 'Content-Type': 'application/json' } }
    );
  }

  try {
    const query = new URLSearchParams({
      order_number: orderNumber,
      tracking_token: trackingToken,
    });

    const response = await fetch(`${getApiBaseUrl()}/orders/track?${query.toString()}`);
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
