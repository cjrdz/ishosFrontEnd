import type { APIRoute } from "astro";
import { getApiBaseUrl } from "../../../../lib/config";

export const prerender = false;

function unauthorized() {
  return new Response(
    JSON.stringify({ error: "Unauthorized", code: "UNAUTHORIZED" }),
    { status: 401, headers: { "Content-Type": "application/json" } },
  );
}

function buildBackendUrl(requestUrl: URL): URL {
  const backendUrl = new URL(`${getApiBaseUrl()}/export/orders`);
  const start = requestUrl.searchParams.get("start");
  const end = requestUrl.searchParams.get("end");
  const format = requestUrl.searchParams.get("format");
  const statuses = requestUrl.searchParams.get("statuses");

  if (start) backendUrl.searchParams.set("start", start);
  if (end) backendUrl.searchParams.set("end", end);
  if (format) backendUrl.searchParams.set("format", format);
  if (statuses) backendUrl.searchParams.set("statuses", statuses);

  return backendUrl;
}

export const GET: APIRoute = async (context) => {
  const token = context.cookies.get("auth_token")?.value;
  if (!token) return unauthorized();

  const backendUrl = buildBackendUrl(context.url);
  const backendResponse = await fetch(backendUrl.toString(), {
    method: "GET",
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  const contentType =
    backendResponse.headers.get("content-type") || "application/octet-stream";
  const disposition =
    backendResponse.headers.get("content-disposition") || undefined;
  const body = await backendResponse.arrayBuffer();

  const headers: Record<string, string> = {
    "Content-Type": contentType,
    "Cache-Control": "no-store, no-cache, must-revalidate, private",
  };
  if (disposition) {
    headers["Content-Disposition"] = disposition;
  }

  return new Response(body, {
    status: backendResponse.status,
    headers,
  });
};

export const DELETE: APIRoute = async (context) => {
  const token = context.cookies.get("auth_token")?.value;
  if (!token) return unauthorized();

  const backendUrl = buildBackendUrl(context.url);
  const backendResponse = await fetch(backendUrl.toString(), {
    method: "DELETE",
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  const data = await backendResponse.text();
  return new Response(data, {
    status: backendResponse.status,
    headers: {
      "Content-Type":
        backendResponse.headers.get("content-type") || "application/json",
      "Cache-Control": "no-store, no-cache, must-revalidate, private",
    },
  });
};
