import type { APIRoute } from "astro";
import { parseOptionalBoundedInt, requireUuidParam } from "@core/bff/params";
import { proxyToBackend } from "@core/bff/proxy";

export const prerender = false;

export const GET: APIRoute = async (context) => {
  const id = requireUuidParam(context, "id");
  if (id instanceof Response) return id;
  const limit = parseOptionalBoundedInt(
    context.url.searchParams.get("limit"),
    1,
    200,
  );
  if (limit instanceof Response) return limit;
  return proxyToBackend(context, `/users/${id}/orders`, {
    query: typeof limit === "number" ? { limit } : undefined,
  });
};
