import type { APIRoute } from "astro";
import { parseJsonBody, userCreateSchema } from "@core/bff/validation";
import { proxyToBackend } from "@core/bff/proxy";

export const prerender = false;

export const POST: APIRoute = async (context) => {
  const parsed = await parseJsonBody(context, userCreateSchema);
  if (!parsed.success) {
    return parsed.response;
  }

  return proxyToBackend(context, "/users/upsert", {
    method: "POST",
    body: parsed.data,
  });
};
