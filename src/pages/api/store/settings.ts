/**
 * GET /api/store/settings
 *
 * Public endpoint returning store status (orders enabled + active offers).
 * No authentication required. Cached 30s at the edge.
 */

import type { APIRoute } from "astro";
import { forwardUpstreamJson, getServerApiBaseUrl } from "@core/bff/proxy";

export const prerender = false;

const CACHE_MAX_AGE = 30;
const STALE_WHILE_REVALIDATE = 120;

export const GET: APIRoute = async (context) => {
  try {
    const response = await fetch(
      `${getServerApiBaseUrl(context)}/settings/store/public`,
    );
    const proxied = await forwardUpstreamJson(response);

    if (!proxied.ok) {
      return proxied;
    }

    const body = await proxied.json();
    return new Response(JSON.stringify(body), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": `public, max-age=${CACHE_MAX_AGE}, stale-while-revalidate=${STALE_WHILE_REVALIDATE}`,
      },
    });
  } catch {
    return new Response(
      JSON.stringify({ error: "Failed to fetch store settings" }),
      { status: 500, headers: { "Content-Type": "application/json" } },
    );
  }
};
