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
  const customerPhone = context.url.searchParams.get('customer_phone')?.trim() ?? '';

  if (!orderNumber || !customerPhone) {
    return new Response(
      JSON.stringify({ error: 'orderNumber and customer_phone are required' }),
      { status: 400, headers: { 'Content-Type': 'application/json' } }
    );
  }

  try {
    const query = new URLSearchParams({
      order_number: orderNumber,
      customer_phone: customerPhone,
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
