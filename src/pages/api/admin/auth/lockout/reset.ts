import type { APIRoute } from "astro";
import { authLockoutResetSchema, parseJsonBody } from "@core/bff/validation";
import { proxyToBackend } from "@core/bff/proxy";

export const prerender = false;

export const POST: APIRoute = async (context) => {
  const parsed = await parseJsonBody(context, authLockoutResetSchema);
  if (!parsed.success) {
    return parsed.response;
  }

  return proxyToBackend(context, "/auth/lockout/reset", {
    method: "POST",
    body: parsed.data,
  });
};
