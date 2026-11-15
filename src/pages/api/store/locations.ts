/**
 * GET /api/store/locations
 *
 * Public list of locations (sucursales) with address, contact, maps and live
 * open/closed status. Short edge cache: hours and switches change rarely,
 * but the open status should flip close to the real time.
 */

import type { APIRoute } from "astro";
import { forwardUpstreamJson, getServerApiBaseUrl } from "@core/bff/proxy";

export const prerender = false;

const CACHE_MAX_AGE = 15;
const STALE_WHILE_REVALIDATE = 30;

export const GET: APIRoute = async (context) => {
  try {
    const response = await fetch(`${getServerApiBaseUrl(context)}/locations`);
    const proxied = await forwardUpstreamJson(response);
    if (!proxied.ok) return proxied;

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
      JSON.stringify({ error: "Failed to fetch locations" }),
      { status: 500, headers: { "Content-Type": "application/json" } },
    );
  }
};
