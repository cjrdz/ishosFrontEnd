import type { APIRoute } from "astro";
import { proxyToBackend } from "../../../../lib/bff/proxy";

export const prerender = false;

export const GET: APIRoute = async (context) => {
  const limit = context.url.searchParams.get("limit") || "10";
  const start = context.url.searchParams.get("start") || "";
  const end = context.url.searchParams.get("end") || "";

  const query: Record<string, string> = { limit };
  if (start) query.start = start;
  if (end) query.end = end;

  return proxyToBackend(context, "/analytics/top-products", {
    query,
  });
};
