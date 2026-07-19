import type { APIRoute } from "astro";
import { proxyToBackend } from "@core/bff/proxy";

export const prerender = false;

export const GET: APIRoute = async (context) => {
  const start = context.url.searchParams.get("start");
  const end = context.url.searchParams.get("end");
  const groupBy = context.url.searchParams.get("groupBy") || "day";
  const limit = context.url.searchParams.get("limit") || "10";

  if (!start || !end) {
    return new Response(
      JSON.stringify({ error: "start and end are required" }),
      { status: 400, headers: { "Content-Type": "application/json" } },
    );
  }

  return proxyToBackend(context, "/analytics/dashboard", {
    query: { start, end, groupBy, limit },
    timeoutMs: 55_000,
  });
};
