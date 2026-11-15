/**
 * POST /api/auth/login
 * Frontend login endpoint (BFF layer)
 *
 * Request body: { email: string, password: string }
 * Response: { employee: Session }
 *
 * Note: Backend sets HttpOnly cookie; this endpoint reads the token from the
 * backend Set-Cookie header and sets its own same-origin HttpOnly cookie.
 */

import { toSpanishMessage } from "@core/errors/messages";
import type { APIRoute } from "astro";
import { LoginSchema } from "@features/admin-management";
import { getApiBaseUrl } from "@core/config";
import { clientIdentityHeaders } from "@core/bff/upstream-headers";

export const prerender = false;

const defaultCookieTTLSeconds = 60 * 60 * 24;

function extractAuthTokenFromSetCookie(
  setCookie: string | null,
): string | null {
  if (!setCookie) return null;

  // Handle multiple Set-Cookie values separated by commas
  // Each cookie starts with a name=value pair
  const cookies = setCookie.split(",");
  for (const cookie of cookies) {
    const trimmed = cookie.trim();
    if (trimmed.startsWith("auth_token=")) {
      const value = trimmed.slice("auth_token=".length);
      const endIdx = value.indexOf(";");
      return endIdx >= 0 ? value.slice(0, endIdx) : value;
    }
  }
  return null;
}

function resolveCookieTTLSeconds(token: string): number {
  const parts = token.split(".");
  if (parts.length !== 3) {
    return defaultCookieTTLSeconds;
  }

  try {
    const base64 = parts[1].replace(/-/g, "+").replace(/_/g, "/");
    const padded = base64.padEnd(
      base64.length + ((4 - (base64.length % 4)) % 4),
      "=",
    );
    const payload = JSON.parse(atob(padded)) as { exp?: number };
    if (!payload.exp || !Number.isFinite(payload.exp)) {
      return defaultCookieTTLSeconds;
    }

    const nowSeconds = Math.floor(Date.now() / 1000);
    const remaining = Math.floor(payload.exp - nowSeconds);
    return remaining > 0 ? remaining : defaultCookieTTLSeconds;
  } catch {
    return defaultCookieTTLSeconds;
  }
}

function buildAuthCookie(
  token: string,
  isSecure: boolean,
  ttlSeconds: number,
): string {
  const parts = [
    `auth_token=${encodeURIComponent(token)}`,
    "Path=/",
    "HttpOnly",
    "SameSite=Lax",
    `Max-Age=${ttlSeconds}`,
  ];

  if (isSecure) {
    parts.push("Secure");
  }

  return parts.join("; ");
}

function isTrustedRequestOrigin(request: Request, requestUrl: URL): boolean {
  const requestOrigin = request.headers.get("origin");
  if (requestOrigin) {
    return requestOrigin === requestUrl.origin;
  }

  const referer = request.headers.get("referer");
  if (!referer) {
    return false;
  }

  try {
    return new URL(referer).origin === requestUrl.origin;
  } catch {
    return false;
  }
}

function getSafeError(value: unknown): string {
  if (typeof value !== "string") return "";
  const sanitized = value.replace(/[\u0000-\u001F\u007F]/g, "").trim();
  return sanitized.slice(0, 180);
}

function getRetryAfterSeconds(
  response: Response,
  payload: Record<string, unknown>,
): number {
  const fromPayload = payload.retryAfter;
  if (
    typeof fromPayload === "number" &&
    Number.isFinite(fromPayload) &&
    fromPayload > 0
  ) {
    return Math.floor(fromPayload);
  }

  const fromHeader = Number.parseInt(
    response.headers.get("retry-after") ?? "",
    10,
  );
  if (Number.isFinite(fromHeader) && fromHeader > 0) {
    return fromHeader;
  }

  return 0;
}

export const POST: APIRoute = async (context) => {
  try {
    if (!isTrustedRequestOrigin(context.request, context.url)) {
      return new Response(
        JSON.stringify({
          error:
            "Solicitud no permitida. Recarga la página e intenta de nuevo.",
          code: "FORBIDDEN_ORIGIN",
        }),
        {
          status: 403,
          headers: {
            "Content-Type": "application/json",
            "Cache-Control": "no-store",
          },
        },
      );
    }

    // Parse and validate request body
    const body = await context.request.json().catch(() => null);
    const parsedBody = LoginSchema.safeParse(body);
    if (!parsedBody.success) {
      return new Response(
        JSON.stringify({
          error: "Correo o contraseña con formato inválido",
          code: "VALIDATION_ERROR",
        }),
        {
          status: 400,
          headers: {
            "Content-Type": "application/json",
            "Cache-Control": "no-store",
          },
        },
      );
    }
    const validated = parsedBody.data;

    const upstreamResponse = await fetch(`${getApiBaseUrl()}/auth/login`, {
      method: "POST",
      headers: {
        ...clientIdentityHeaders(context),
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        email: validated.email,
        password: validated.password,
      }),
    });

    const upstreamContentType =
      upstreamResponse.headers.get("content-type")?.toLowerCase() ?? "";
    const upstreamPayload = upstreamContentType.includes("application/json")
      ? ((await upstreamResponse.json()) as Record<string, unknown>)
      : { error: await upstreamResponse.text() };

    if (!upstreamResponse.ok) {
      const retryAfter = getRetryAfterSeconds(
        upstreamResponse,
        upstreamPayload,
      );
      const status = upstreamResponse.status;
      const error = toSpanishMessage(
        getSafeError(upstreamPayload.error),
        status,
      );
      const code = status === 429 ? "RATE_LIMITED" : "LOGIN_ERROR";
      const headers: Record<string, string> = {
        "Content-Type": "application/json",
        "Cache-Control": "no-store",
      };

      if (retryAfter > 0) {
        headers["Retry-After"] = String(retryAfter);
      }

      return new Response(
        JSON.stringify({
          error,
          code,
          retryAfter,
        }),
        {
          status,
          headers,
        },
      );
    }

    // Extract token from backend Set-Cookie header (cookie-only, not in response body)
    const setCookieHeader = upstreamResponse.headers.get("set-cookie");
    const token = extractAuthTokenFromSetCookie(setCookieHeader);

    const employee =
      upstreamPayload.employee && typeof upstreamPayload.employee === "object"
        ? (upstreamPayload.employee as Record<string, unknown>)
        : null;

    if (!token || !employee) {
      return new Response(
        JSON.stringify({
          error: "No se pudo iniciar sesión. Intenta de nuevo.",
          code: "LOGIN_ERROR",
        }),
        {
          status: 502,
          headers: {
            "Content-Type": "application/json",
            "Cache-Control": "no-store",
          },
        },
      );
    }

    // The cookie lives as long as the token, capped by the admin's
    // "Cookie de sesión" setting (sent by the backend).
    const sessionMaxAge = Number(upstreamPayload.session_max_age_seconds);
    const ttlSeconds =
      Number.isFinite(sessionMaxAge) && sessionMaxAge > 0
        ? Math.min(resolveCookieTTLSeconds(token), Math.floor(sessionMaxAge))
        : resolveCookieTTLSeconds(token);

    const forwardedProto = context.request.headers.get("x-forwarded-proto");
    // Production is always HTTPS; locally follow the request scheme.
    const isSecure =
      import.meta.env.PROD ||
      (forwardedProto ?? context.url.protocol.replace(":", "")) === "https";

    // Set same-origin HttpOnly cookie so Astro middleware can validate /admin routes.
    context.cookies.set("auth_token", token, {
      path: "/",
      httpOnly: true,
      sameSite: "lax",
      secure: isSecure,
      maxAge: ttlSeconds,
    });

    const safeResponse = {
      employee: {
        ...employee,
        active: typeof employee.active === "boolean" ? employee.active : true,
      },
    };

    // Return response with explicit Set-Cookie for edge/runtime consistency.
    return new Response(JSON.stringify(safeResponse), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": "no-store, no-cache, must-revalidate, private",
        Pragma: "no-cache",
        Expires: "0",
        "Set-Cookie": buildAuthCookie(token, isSecure, ttlSeconds),
      },
    });
  } catch (error) {
    if (error instanceof Error) {
      if (
        error.message.includes("validation") ||
        error.message.includes("Validation")
      ) {
        return new Response(
          JSON.stringify({
            error: "Revisa el correo y la contraseña.",
            code: "VALIDATION_ERROR",
          }),
          {
            status: 400,
            headers: {
              "Content-Type": "application/json",
              "Cache-Control": "no-store",
            },
          },
        );
      }

      // Network/runtime details stay in the server log, not the response.
      console.error("[login] failed:", error.message);
      return new Response(
        JSON.stringify({
          error: "No se pudo iniciar sesión. Intenta de nuevo.",
          code: "LOGIN_ERROR",
        }),
        {
          status: 401,
          headers: {
            "Content-Type": "application/json",
            "Cache-Control": "no-store",
          },
        },
      );
    }

    return new Response(
      JSON.stringify({
        error: "Ocurrió un error inesperado. Intenta de nuevo.",
        code: "SERVER_ERROR",
      }),
      { status: 500, headers: { "Content-Type": "application/json" } },
    );
  }
};
