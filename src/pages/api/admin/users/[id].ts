import type { APIRoute } from "astro";
import { requireUuidParam } from "../../../../lib/bff/params";
import { proxyToBackend } from "../../../../lib/bff/proxy";

export const prerender = false;

export const GET: APIRoute = async (context) => {
  const id = requireUuidParam(context, "id");
  if (id instanceof Response) return id;
  return proxyToBackend(context, `/users/${id}`);
};

export const PATCH: APIRoute = async (context) => {
  const id = requireUuidParam(context, "id");
  if (id instanceof Response) return id;
  try {
    const body = await context.request.json();
    return proxyToBackend(context, `/users/${id}`, {
      method: "PATCH",
      body,
    });
  } catch {
    return new Response(JSON.stringify({ error: "Invalid request body" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }
};

export const DELETE: APIRoute = async (context) => {
  const id = requireUuidParam(context, "id");
  if (id instanceof Response) return id;
  return proxyToBackend(context, `/users/${id}`, { method: "DELETE" });
};
