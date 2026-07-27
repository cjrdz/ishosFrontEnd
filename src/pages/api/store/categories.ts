/**
 * GET /api/store/categories
 * GET /api/store/categories?page=1&per_page=20
 * GET /api/store/categories?all=true
 *
 * Public endpoint for fetching categories. Forwards pagination params to the
 * backend and caches the response at the edge for 60 seconds.
 */

import type { APIRoute } from "astro";
import { forwardUpstreamJson, getServerApiBaseUrl } from "@core/bff/proxy";

export const prerender = false;

const CACHE_MAX_AGE_SECONDS = 60;

export const GET: APIRoute = async (context) => {
  const page = context.url.searchParams.get("page");
  const perPage = context.url.searchParams.get("per_page");
  const includeAll = context.url.searchParams.get("all") === "true";

  try {
    const url = new URL(`${getServerApiBaseUrl(context)}/categories`);
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
    return new Response(
      JSON.stringify({ error: "Failed to fetch categories" }),
      { status: 500, headers: { "Content-Type": "application/json" } },
    );
  }
};
