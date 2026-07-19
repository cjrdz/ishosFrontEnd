/**
 * GET /api/store/products
 * GET /api/store/products?category=electronics&page=1&per_page=20
 * GET /api/store/products?all=true
 *
 * Public endpoint for fetching products. Forwards pagination params to the
 * backend and caches the response at the edge for 60 seconds.
 */

import type { APIRoute } from "astro";
import { forwardUpstreamJson, getServerApiBaseUrl } from "@core/bff/proxy";

export const prerender = false;

const CACHE_MAX_AGE_SECONDS = 60;

export const GET: APIRoute = async (context) => {
  const category = context.url.searchParams.get("category") || "";
  const page = context.url.searchParams.get("page");
  const perPage = context.url.searchParams.get("per_page");
  const includeAll = context.url.searchParams.get("all") === "true";

  try {
    const url = new URL(`${getServerApiBaseUrl(context)}/products`);
    if (category) {
      url.searchParams.set("category", category);
    }
    if (includeAll) {
      url.searchParams.set("all", "true");
    } else {
      if (page) url.searchParams.set("page", page);
      if (perPage) url.searchParams.set("per_page", perPage);
    }

    const response = await fetch(url.toString());
    const upstream = await forwardUpstreamJson(response);

    return new Response(upstream.body, {
      status: upstream.status,
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": `public, max-age=${CACHE_MAX_AGE_SECONDS}`,
      },
    });
  } catch {
    return new Response(JSON.stringify({ error: "Failed to fetch products" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
};
