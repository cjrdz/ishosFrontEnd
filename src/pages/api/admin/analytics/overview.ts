import type { APIRoute } from "astro";
import { proxyToBackend } from "../../../../lib/bff/proxy";

export const prerender = false;

export const GET: APIRoute = async (context) => {
  const period = context.url.searchParams.get("period") || "month";
  return proxyToBackend(context, "/analytics/overview", {
    query: { period },
  });
};
