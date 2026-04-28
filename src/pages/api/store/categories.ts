/**
 * GET /api/store/categories
 *
 * Public endpoint for fetching categories
 * No authentication required
 */

import type { APIRoute } from "astro";
import { forwardUpstreamJson, getServerApiBaseUrl } from "@core/bff/proxy";

export const prerender = false;

export const GET: APIRoute = async (context) => {
  try {
    const response = await fetch(`${getServerApiBaseUrl(context)}/categories`);
    return forwardUpstreamJson(response);
  } catch {
    return new Response(
      JSON.stringify({ error: "Failed to fetch categories" }),
      { status: 500, headers: { "Content-Type": "application/json" } },
    );
  }
};
