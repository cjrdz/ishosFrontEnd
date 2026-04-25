/**
 * Astro middleware for admin route protection and security headers
 *
 * This middleware:
 * 1. Injects security headers (CSP, HSTS, etc.) on every response
 * 2. Validates that admin routes have authentication
 * 3. Checks session validity
 * 4. Returns 401/403 for API endpoints, redirects for pages
 */

import { defineMiddleware } from "astro:middleware";
import { getSession } from "./lib/api/auth";
import { getApiBaseUrl } from "./lib/config";

// Routes that require authentication
const protectedRoutes = ["/admin"];

// Routes that don't require authentication
const publicRoutes = ["/admin/login"];

/** Build Content-Security-Policy header value. */
function buildCSP(requestUrl: URL): string {
  const apiOrigin = (() => {
    try {
      return new URL(getApiBaseUrl()).origin;
    } catch {
      return "";
    }
  })();

  // Collect external connect targets
  const connectSrc = ["'self'", apiOrigin, "https://imagedelivery.net"]
    .filter(Boolean)
    .join(" ");

  const directives: string[] = [
    "default-src 'self'",
    "script-src 'self' 'unsafe-inline'", // Svelte/Astro inline scripts require unsafe-inline
    "style-src 'self' 'unsafe-inline'", // Tailwind inline styles
    `connect-src ${connectSrc}`,
    "img-src 'self' data: blob: https://imagedelivery.net https://*.r2.dev",
    "font-src 'self' data:",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
    "frame-src https://www.google.com https://maps.google.com",
  ];

  // Only force HTTP->HTTPS upgrades when the current request is already served
  // over HTTPS in production. Enabling this on local/LAN HTTP dev causes the
  // browser to rewrite Vite and /src asset requests to https://<ip>:4321, which
  // fails with ERR_SSL_PROTOCOL_ERROR.
  if (import.meta.env.PROD && requestUrl.protocol === "https:") {
    directives.push("upgrade-insecure-requests");
  }

  return directives.join("; ");
}

/** Inject hardened security headers into an existing Response. */
function withSecurityHeaders(response: Response, requestUrl: URL): Response {
  const headers = new Headers(response.headers);

  headers.set("Content-Security-Policy", buildCSP(requestUrl));
  headers.set("X-Content-Type-Options", "nosniff");
  headers.set("X-Frame-Options", "DENY");
  headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  headers.set("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
  // HSTS only in production (Cloudflare Workers / Vercel handle TLS)
  if (import.meta.env.PROD) {
    headers.set(
      "Strict-Transport-Security",
      "max-age=31536000; includeSubDomains",
    );
  }
  // Remove fingerprinting header added by some adapters
  headers.delete("X-Powered-By");

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

export const onRequest = defineMiddleware(async (context, next) => {
  const { pathname } = context.url;

  // Check if this is a protected route
  const isProtectedRoute = protectedRoutes.some((route) =>
    pathname.startsWith(route),
  );
  const isPublicRoute = publicRoutes.some((route) =>
    pathname.startsWith(route),
  );

  // Skip auth check for public routes but still apply security headers
  if (isPublicRoute) {
    return withSecurityHeaders(await next(), context.url);
  }

  // Check if protected route requires auth
  if (isProtectedRoute) {
    const authCookie = context.cookies.get("auth_token")?.value;

    // No session - redirect to login
    if (!authCookie) {
      if (pathname.startsWith("/api/")) {
        return new Response(
          JSON.stringify({ error: "Unauthorized", code: "UNAUTHORIZED" }),
          { status: 401, headers: { "Content-Type": "application/json" } },
        );
      }
      return context.redirect("/admin/login");
    }

    // Session cookie exists - verify token validity directly against backend.
    try {
      await getSession(authCookie);
      return withSecurityHeaders(await next(), context.url);
    } catch {
      context.cookies.delete("auth_token", { path: "/" });
      if (pathname.startsWith("/api/")) {
        return new Response(
          JSON.stringify({ error: "Unauthorized", code: "UNAUTHORIZED" }),
          {
            status: 401,
            headers: {
              "Content-Type": "application/json",
              "Cache-Control": "no-store",
            },
          },
        );
      }
      return context.redirect("/admin/login");
    }
  }

  // Not a protected route - apply security headers and continue
  return withSecurityHeaders(await next(), context.url);
});
