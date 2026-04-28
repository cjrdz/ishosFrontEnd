/**
 * GET /api/store/featured
 *
 * Returns up to 4 available featured products for the homepage.
 * Fetches a small page from the backend rather than pulling the entire
 * catalogue client-side, reducing payload and TTFB.
 *
 * Response is cached at the edge for 60 s (stale-while-revalidate 300 s).
 */

import type { APIRoute } from "astro";
import { forwardUpstreamJson, getServerApiBaseUrl } from "@core/bff/proxy";

export const prerender = false;

const FEATURED_LIMIT = 4;
const CACHE_MAX_AGE = 60; // seconds at edge
const STALE_WHILE_REVALIDATE = 300; // seconds SWR window

export const GET: APIRoute = async (context) => {
  try {
    const url = new URL(`${getServerApiBaseUrl(context)}/products`);
    // Fetch a small page; backend already orders by availability/creation
    url.searchParams.set("limit", String(FEATURED_LIMIT * 2)); // slight buffer for filtering
    url.searchParams.set("offset", "0");

    const upstream = await fetch(url.toString());
    const proxied = await forwardUpstreamJson(upstream);

    if (!proxied.ok) {
      return proxied;
    }

    // Filter to available products and cap at FEATURED_LIMIT
    let products: unknown[] = [];
    try {
      const body = (await proxied.json()) as unknown;
      const raw = Array.isArray(body)
        ? body
        : ((body as { products?: unknown[] }).products ?? []);
      products = (raw as Array<{ is_available?: boolean }>)
        .filter((p) => p.is_available !== false)
        .slice(0, FEATURED_LIMIT);
    } catch {
      return new Response(
        JSON.stringify({ error: "Failed to parse products" }),
        { status: 502, headers: { "Content-Type": "application/json" } },
      );
    }

    return new Response(JSON.stringify(products), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": `public, max-age=${CACHE_MAX_AGE}, stale-while-revalidate=${STALE_WHILE_REVALIDATE}`,
      },
    });
  } catch {
    return new Response(
      JSON.stringify({ error: "Failed to fetch featured products" }),
      { status: 500, headers: { "Content-Type": "application/json" } },
    );
  }
};
