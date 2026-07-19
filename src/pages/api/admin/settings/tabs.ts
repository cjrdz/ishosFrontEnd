import type { APIRoute } from "astro";
import { parseJsonBody, tabsSettingsSchema } from "@core/bff/validation";
import { proxyToBackend } from "@core/bff/proxy";

export const prerender = false;

export const GET: APIRoute = async (context) => {
  return proxyToBackend(context, "/settings/tabs");
};

export const PATCH: APIRoute = async (context) => {
  const parsed = await parseJsonBody(context, tabsSettingsSchema);
  if (!parsed.success) {
    return parsed.response;
  }

  return proxyToBackend(context, "/settings/tabs", {
    method: "PATCH",
    body: parsed.data,
  });
};
