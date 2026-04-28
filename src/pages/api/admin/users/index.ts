import type { APIRoute } from "astro";
import { proxyToBackend } from "@core/bff/proxy";

export const prerender = false;

export const GET: APIRoute = async (context) => {
  const status = context.url.searchParams.get("status") || "";
  const search = context.url.searchParams.get("search") || "";
  const query: Record<string, string> = {};
  if (status) query.status = status;
  if (search) query.search = search;
  return proxyToBackend(context, "/users", {
    query: Object.keys(query).length > 0 ? query : undefined,
  });
};

export const POST: APIRoute = async (context) => {
  try {
    const body = await context.request.json();
    return proxyToBackend(context, "/users", {
      method: "POST",
      body,
    });
  } catch {
    return new Response(JSON.stringify({ error: "Invalid request body" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }
};
