import type { APIRoute } from "astro";
import { panelConfigUpdateSchema, parseJsonBody } from "@core/bff/validation";
import { proxyToBackend } from "@core/bff/proxy";

export const prerender = false;

export const GET: APIRoute = async (context) => {
  return proxyToBackend(context, "/settings/panel-config");
};

export const PATCH: APIRoute = async (context) => {
  const parsed = await parseJsonBody(context, panelConfigUpdateSchema);
  if (!parsed.success) {
    return parsed.response;
  }

  return proxyToBackend(context, "/settings/panel-config", {
    method: "PATCH",
    body: parsed.data,
  });
};
