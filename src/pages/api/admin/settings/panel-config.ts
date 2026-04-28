import type { APIRoute } from "astro";
import { proxyToBackend } from "@core/bff/proxy";

export const prerender = false;

export const GET: APIRoute = async (context) => {
  return proxyToBackend(context, "/settings/panel-config");
};

export const PATCH: APIRoute = async (context) => {
  try {
    const body = await context.request.json();
    return proxyToBackend(context, "/settings/panel-config", {
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
