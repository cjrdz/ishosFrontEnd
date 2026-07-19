/**
 * BFF proxy utility for forwarding authenticated requests to backend
 *
 * This handles:
 * - Token extraction from HttpOnly cookies
 * - Request proxying with authentication
 * - Defense-in-depth body-size guard and security logging
 * - Error handling and response forwarding
 */

import type { APIContext } from "astro";
import { getApiBaseUrl } from "../config";

const DEFAULT_BODY_LIMIT_BYTES = 64 * 1024; // 64 KiB
const MAX_BODY_LIMIT_BYTES = 10 * 1024 * 1024; // 10 MiB

export interface ProxyOptions {
  method?: "GET" | "POST" | "PATCH" | "DELETE" | "PUT";
  body?: unknown;
  query?: Record<string, string | number | boolean>;
  headers?: Record<string, string>;
  isFormData?: boolean;
  bodyLimitBytes?: number;
  timeoutMs?: number;
}

export interface ProxyFormDataOptions extends Omit<ProxyOptions, "body"> {
  isFormData: true;
  body: FormData;
}

export function getServerApiBaseUrl(_context: APIContext): string {
  return getApiBaseUrl();
}

function sanitizeForLog(value: string): string {
  // Strip control characters and truncate to avoid log injection/explosion.
  return value.replace(/[\u0000-\u001F\u007F]/g, "").slice(0, 256);
}

function logSecurityEvent(
  context: APIContext,
  event: string,
  details: Record<string, unknown>,
): void {
  const requestId = crypto.randomUUID();
  const clientIp =
    context.request.headers.get("x-forwarded-for") ??
    context.request.headers.get("cf-connecting-ip") ??
    "unknown";

  const safeDetails: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(details)) {
    if (typeof value === "string") {
      safeDetails[key] = sanitizeForLog(value);
    } else if (typeof value === "number" || typeof value === "boolean") {
      safeDetails[key] = value;
    } else {
      safeDetails[key] = "[redacted]";
    }
  }

  console.warn(
    JSON.stringify({
      event: `security.${event}`,
      requestId,
      path: context.url.pathname,
      method: context.request.method,
      clientIp: sanitizeForLog(clientIp),
      ...safeDetails,
    }),
  );
}

function jsonResponse(body: Record<string, unknown>, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "no-store",
    },
  });
}

function resolveBodyLimit(
  options: ProxyOptions | ProxyFormDataOptions,
): number {
  if (options.bodyLimitBytes !== undefined) {
    return Math.min(options.bodyLimitBytes, MAX_BODY_LIMIT_BYTES);
  }
  return options.isFormData ? MAX_BODY_LIMIT_BYTES : DEFAULT_BODY_LIMIT_BYTES;
}

function checkBodySize(
  request: Request,
  options: ProxyOptions | ProxyFormDataOptions,
  limitBytes: number,
): Response | null {
  const method = (options.method ?? request.method).toUpperCase();
  if (method === "GET" || method === "HEAD" || method === "OPTIONS") {
    return null;
  }

  const hasOutgoingBody = options.isFormData
    ? options.body instanceof FormData && [...options.body.entries()].length > 0
    : options.body !== undefined;

  // DELETE and other bodyless mutations should not require Content-Length.
  if (!hasOutgoingBody && method === "DELETE") {
    return null;
  }

  const contentLength = request.headers.get("content-length");
  if (!contentLength) {
    return jsonResponse(
      {
        error: "Content-Length required",
        code: "CONTENT_LENGTH_REQUIRED",
      },
      411,
    );
  }

  const size = Number.parseInt(contentLength, 10);
  if (!Number.isFinite(size) || size < 0) {
    return jsonResponse(
      {
        error: "Invalid Content-Length",
        code: "INVALID_CONTENT_LENGTH",
      },
      400,
    );
  }

  if (size > limitBytes) {
    return jsonResponse(
      {
        error: "Request body too large",
        code: "REQUEST_TOO_LARGE",
        limit: limitBytes,
      },
      413,
    );
  }

  return null;
}

export async function forwardUpstreamJson(
  response: Response,
): Promise<Response> {
  const contentType = response.headers.get("content-type")?.toLowerCase() ?? "";
  let data: unknown;

  if (contentType.includes("application/json")) {
    data = await response.json();
  } else {
    const rawText = await response.text();
    const trimmedText = rawText.trim();

    if (trimmedText.startsWith("{") || trimmedText.startsWith("[")) {
      try {
        data = JSON.parse(trimmedText);
      } catch {
        data = response.ok
          ? { message: trimmedText || "OK" }
          : { error: trimmedText || "Request failed" };
      }
    } else {
      data = response.ok
        ? { message: trimmedText || "OK" }
        : { error: trimmedText || "Request failed" };
    }
  }

  return new Response(JSON.stringify(data), {
    status: response.status,
    headers: { "Content-Type": "application/json" },
  });
}

export async function proxyToBackend(
  context: APIContext,
  path: string,
  options: ProxyOptions | ProxyFormDataOptions = {},
): Promise<Response> {
  const bodySizeError = checkBodySize(
    context.request,
    options,
    resolveBodyLimit(options),
  );
  if (bodySizeError) {
    logSecurityEvent(context, "body_size_exceeded", {
      limit: resolveBodyLimit(options),
    });
    return bodySizeError;
  }

  const token = context.cookies.get("auth_token")?.value;

  if (!token) {
    logSecurityEvent(context, "missing_auth_token", {});
    return jsonResponse({ error: "Unauthorized", code: "UNAUTHORIZED" }, 401);
  }

  const headers: Record<string, string> = {
    Authorization: `Bearer ${token}`,
    ...options.headers,
  };

  // Forward conditional request headers so backend 304 responses work.
  const conditionalHeaders = [
    "if-modified-since",
    "if-none-match",
    "if-match",
    "if-unmodified-since",
  ];
  for (const name of conditionalHeaders) {
    const value = context.request.headers.get(name);
    if (value) {
      headers[name] = value;
    }
  }

  // Only set Content-Type for non-FormData requests
  if (!options.isFormData && !headers["Content-Type"]) {
    headers["Content-Type"] = "application/json";
  }

  const url = new URL(`${getServerApiBaseUrl(context)}${path}`);
  if (options.query) {
    Object.entries(options.query).forEach(([key, value]) => {
      url.searchParams.set(key, String(value));
    });
  }

  const controller = new AbortController();
  const timeoutMs = options.timeoutMs ?? 30000;
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url.toString(), {
      method: options.method ?? "GET",
      headers,
      body:
        options.isFormData && options.body instanceof FormData
          ? (options.body as FormData)
          : options.body
            ? JSON.stringify(options.body)
            : undefined,
      signal: controller.signal,
    });

    // Pass through 304 Not Modified without consuming or re-serializing the body.
    if (response.status === 304) {
      const passthroughHeaders: Record<string, string> = {
        "Cache-Control": "no-store, no-cache, must-revalidate, private",
      };
      const lastModified = response.headers.get("last-modified");
      if (lastModified) {
        passthroughHeaders["Last-Modified"] = lastModified;
      }
      return new Response(null, { status: 304, headers: passthroughHeaders });
    }

    const contentType =
      response.headers.get("content-type")?.toLowerCase() ?? "";
    let data: unknown;

    if (contentType.includes("application/json")) {
      data = await response.json();
    } else {
      const rawText = await response.text();
      const trimmedText = rawText.trim();

      if (trimmedText.startsWith("{") || trimmedText.startsWith("[")) {
        try {
          data = JSON.parse(trimmedText);
        } catch {
          data = response.ok
            ? { message: trimmedText || "OK" }
            : { error: trimmedText || "Request failed" };
        }
      } else {
        data = response.ok
          ? { message: trimmedText || "OK" }
          : { error: trimmedText || "Request failed" };
      }
    }

    return new Response(JSON.stringify(data), {
      status: response.status,
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": "no-store, no-cache, must-revalidate, private",
        Pragma: "no-cache",
        Expires: "0",
      },
    });
  } catch (error) {
    console.error("Backend proxy error:", error);
    if (error instanceof DOMException && error.name === "AbortError") {
      logSecurityEvent(context, "upstream_timeout", { upstreamPath: path });
      return jsonResponse(
        { error: "Backend request timed out", code: "UPSTREAM_TIMEOUT" },
        504,
      );
    }
    logSecurityEvent(context, "upstream_error", {
      upstreamPath: path,
    });
    return jsonResponse(
      {
        error: "Backend request failed",
        code: "BACKEND_ERROR",
      },
      502,
    );
  } finally {
    clearTimeout(timeout);
  }
}

interface StreamProxyOptions {
  method?: "GET" | "DELETE";
  query?: Record<string, string | number | boolean>;
  headers?: Record<string, string>;
  timeoutMs?: number;
}

/**
 * Proxy a backend request and stream the response body directly to the client.
 * Useful for file downloads where buffering the entire payload into memory
 * would risk worker OOM.
 */
export async function proxyToBackendStream(
  context: APIContext,
  path: string,
  options: StreamProxyOptions = {},
): Promise<Response> {
  const token = context.cookies.get("auth_token")?.value;

  if (!token) {
    logSecurityEvent(context, "missing_auth_token", {});
    return jsonResponse({ error: "Unauthorized", code: "UNAUTHORIZED" }, 401);
  }

  const headers: Record<string, string> = {
    Authorization: `Bearer ${token}`,
    ...options.headers,
  };

  const url = new URL(`${getServerApiBaseUrl(context)}${path}`);
  if (options.query) {
    Object.entries(options.query).forEach(([key, value]) => {
      url.searchParams.set(key, String(value));
    });
  }

  const controller = new AbortController();
  const timeoutMs = options.timeoutMs ?? 110_000;
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url.toString(), {
      method: options.method ?? "GET",
      headers,
      signal: controller.signal,
    });

    const outgoingHeaders: Record<string, string> = {
      "Cache-Control": "no-store, no-cache, must-revalidate, private",
    };

    const contentType = response.headers.get("content-type");
    if (contentType) {
      outgoingHeaders["Content-Type"] = contentType;
    }

    const disposition = response.headers.get("content-disposition");
    if (disposition) {
      outgoingHeaders["Content-Disposition"] = disposition;
    }

    const body = response.body ?? (await response.arrayBuffer());

    return new Response(body, {
      status: response.status,
      headers: outgoingHeaders,
    });
  } catch (error) {
    console.error("Backend stream proxy error:", error);
    if (error instanceof DOMException && error.name === "AbortError") {
      logSecurityEvent(context, "upstream_timeout", { upstreamPath: path });
      return jsonResponse(
        { error: "Backend request timed out", code: "UPSTREAM_TIMEOUT" },
        504,
      );
    }
    logSecurityEvent(context, "upstream_error", { upstreamPath: path });
    return jsonResponse(
      { error: "Backend request failed", code: "BACKEND_ERROR" },
      502,
    );
  } finally {
    clearTimeout(timeout);
  }
}
