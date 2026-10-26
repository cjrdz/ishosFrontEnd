import type { APIContext, MiddlewareNext } from "astro";
import { defineMiddleware } from "astro:middleware";
import { getSecret } from "astro:env/server";
import { getSession } from "@features/auth";
import { getAdminImageUploadMaxMB } from "@core/config";
import type { Session } from "./types/auth";
import { allowInlineStyles, mergeCspDirectives } from "@core/security/csp";
import { SESSION_CACHE_COOKIE } from "@core/security/session-cache";

/**
 * Routes that bypass session/role checks. All other /admin and /api/admin
 * routes require an authenticated admin session.
 */
const AUTH_EXEMPT_PREFIXES = [
  "/admin/login",
  "/api/admin/login",
  "/api/admin/session",
  "/api/admin/logout",
];

const ADMIN_API_PREFIX = "/api/admin/";
const ADMIN_PAGE_ROOT = "/admin";
const ADMIN_PAGE_PREFIX = "/admin/";

// Admin pages staff may open (the orders dashboard). Other admin pages
// (settings, analytics) are admin-only and redirect staff back here.
const STAFF_ALLOWED_PAGES = new Set([ADMIN_PAGE_ROOT, ADMIN_PAGE_PREFIX]);

// Routes that staff/managers may use in addition to admins. All other
// /api/admin/* routes remain admin-only.
const STAFF_ALLOWED_API_PREFIXES = [
  "/api/admin/orders",
  "/api/admin/products",
  "/api/admin/categories",
  "/api/admin/flavors",
  "/api/admin/addons",
];

const DEFAULT_JSON_BODY_LIMIT_BYTES = 64 * 1024; // 64 KiB
const BYTES_PER_MB = 1024 * 1024;

function isAuthExempt(pathname: string): boolean {
  return AUTH_EXEMPT_PREFIXES.some((prefix) => pathname.startsWith(prefix));
}

function isAdminApiRoute(pathname: string): boolean {
  return pathname.startsWith(ADMIN_API_PREFIX);
}

function isAdminPageRoute(pathname: string): boolean {
  // Match "/admin" exactly as well as "/admin/..."; a bare prefix check on
  // "/admin/" let the dashboard at "/admin" skip authentication.
  return pathname === ADMIN_PAGE_ROOT || pathname.startsWith(ADMIN_PAGE_PREFIX);
}

function isStaffAllowedApiRoute(pathname: string): boolean {
  return STAFF_ALLOWED_API_PREFIXES.some((prefix) =>
    pathname.startsWith(prefix),
  );
}

function isImageUploadRoute(pathname: string): boolean {
  return (
    pathname === "/api/admin/images" ||
    pathname.startsWith("/api/admin/images/")
  );
}

function getBodySizeLimitBytes(pathname: string): number {
  if (isImageUploadRoute(pathname)) {
    return getAdminImageUploadMaxMB() * BYTES_PER_MB;
  }
  return DEFAULT_JSON_BODY_LIMIT_BYTES;
}

function jsonResponse(
  body: Record<string, unknown>,
  status: number,
  extraHeaders: Record<string, string> = {},
): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "no-store",
      ...extraHeaders,
    },
  });
}

/**
 * Check request body size against route-specific limit using Content-Length.
 * Returns null when the request is within limits.
 */
function checkBodySize(request: Request, pathname: string): Response | null {
  const method = request.method.toUpperCase();
  if (method === "GET" || method === "HEAD" || method === "OPTIONS") {
    return null;
  }

  const contentLength = request.headers.get("content-length");
  if (!contentLength) {
    // Bodyless DELETEs (e.g. /api/admin/{resource}/{id}) do not need a
    // Content-Length header; browsers/edge runtimes often omit it.
    if (method === "DELETE") {
      return null;
    }

    // Reject uploads and large writes without an explicit length to avoid
    // streaming abuse in edge runtimes.
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

  const limit = getBodySizeLimitBytes(pathname);
  if (size > limit) {
    return jsonResponse(
      {
        error: "Request body too large",
        code: "REQUEST_TOO_LARGE",
        limit,
      },
      413,
    );
  }

  return null;
}

/**
 * Validate that state-changing requests come from a same-origin/trusted source.
 */
function isTrustedRequestOrigin(request: Request, requestUrl: URL): boolean {
  const origin = request.headers.get("origin");
  if (origin) {
    return origin === requestUrl.origin;
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

function checkOrigin(request: Request, requestUrl: URL): Response | null {
  const method = request.method.toUpperCase();
  if (method === "GET" || method === "HEAD" || method === "OPTIONS") {
    return null;
  }

  if (!isTrustedRequestOrigin(request, requestUrl)) {
    return jsonResponse(
      {
        error: "Forbidden",
        code: "FORBIDDEN_ORIGIN",
      },
      403,
    );
  }

  return null;
}

function redirectToLogin(request: Request): Response {
  const isApi = new URL(request.url).pathname.startsWith(ADMIN_API_PREFIX);
  if (isApi) {
    return jsonResponse(
      {
        error: "Unauthorized",
        code: "UNAUTHORIZED",
      },
      401,
    );
  }

  return new Response(null, {
    status: 302,
    headers: {
      Location: "/admin/login",
      "Cache-Control": "no-store",
    },
  });
}

function requireRole(
  session: Session | null,
  allowedRoles: readonly Session["role"][],
): Response | null {
  if (!session) {
    return null;
  }
  if (!allowedRoles.includes(session.role)) {
    return jsonResponse(
      {
        error: "Forbidden",
        code: "INSUFFICIENT_PRIVILEGES",
      },
      403,
    );
  }
  return null;
}

function getSessionCacheSecret(): string | null {
  // astro:env resolves secrets at request time (Worker secret / process.env).
  // import.meta.env would inline the build-time value, which is empty in CI,
  // so the cache was silently disabled in production.
  const secret = getSecret("SESSION_CACHE_SECRET");
  if (typeof secret === "string" && secret.length > 0) {
    return secret;
  }
  return null;
}

/**
 * Short, non-reversible fingerprint of the auth token. Stored in the session
 * cache so a cached session is only honoured for the token it was issued for
 * (a logout, or a login as someone else, never reuses it).
 */
async function tokenFingerprint(token: string): Promise<string> {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(token),
  );
  return encodeBase64(digest).slice(0, 22);
}

function encodeBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=/g, "");
}

function decodeBase64(text: string): Uint8Array {
  const normalized = text.replace(/-/g, "+").replace(/_/g, "/");
  const padded = normalized.padEnd(
    normalized.length + ((4 - (normalized.length % 4)) % 4),
    "=",
  );
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

async function importSigningKey(secret: string): Promise<CryptoKey> {
  const encoder = new TextEncoder();
  const keyData = encoder.encode(secret);
  return crypto.subtle.importKey(
    "raw",
    keyData,
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"],
  );
}

async function signCookie(value: string, secret: string): Promise<string> {
  const key = await importSigningKey(secret);
  const encoder = new TextEncoder();
  const signature = await crypto.subtle.sign(
    "HMAC",
    key,
    encoder.encode(value),
  );
  return `${value}.${encodeBase64(signature)}`;
}

async function verifyCookie(
  signedValue: string,
  secret: string,
): Promise<string | null> {
  const lastDot = signedValue.lastIndexOf(".");
  if (lastDot < 0) {
    return null;
  }
  const value = signedValue.slice(0, lastDot);
  const signatureB64 = signedValue.slice(lastDot + 1);
  if (!signatureB64) {
    return null;
  }

  let signature: Uint8Array;
  try {
    signature = decodeBase64(signatureB64);
  } catch {
    return null;
  }

  const key = await importSigningKey(secret);
  const encoder = new TextEncoder();
  const valid = await crypto.subtle.verify(
    "HMAC",
    key,
    signature.buffer as ArrayBuffer,
    encoder.encode(value),
  );
  return valid ? value : null;
}

function serializeSession(session: Session, fingerprint: string): string {
  return JSON.stringify({
    id: session.id,
    email: session.email,
    name: session.name,
    role: session.role,
    active: session.active,
    tf: fingerprint,
  });
}

function parseSession(value: string, fingerprint: string): Session | null {
  try {
    const parsed = JSON.parse(value) as Record<string, unknown>;
    if (
      parsed.tf === fingerprint &&
      typeof parsed.id === "string" &&
      typeof parsed.email === "string" &&
      typeof parsed.name === "string" &&
      typeof parsed.role === "string" &&
      typeof parsed.active === "boolean" &&
      (parsed.role === "admin" ||
        parsed.role === "manager" ||
        parsed.role === "staff" ||
        parsed.role === "employee")
    ) {
      return {
        id: parsed.id,
        email: parsed.email,
        name: parsed.name,
        role: parsed.role,
        active: parsed.active,
      } as Session;
    }
  } catch {
    // ignore malformed cache payload
  }
  return null;
}

async function getCachedSession(
  context: {
    cookies: {
      get: (name: string) => { value?: string } | undefined;
    };
  },
  token: string,
): Promise<Session | null> {
  const secret = getSessionCacheSecret();
  if (!secret) {
    return null;
  }

  const raw = context.cookies.get(SESSION_CACHE_COOKIE)?.value;
  if (!raw) {
    return null;
  }

  const verified = await verifyCookie(raw, secret);
  if (!verified) {
    return null;
  }

  return parseSession(verified, await tokenFingerprint(token));
}

async function setCachedSession(
  context: {
    cookies: {
      set: (
        name: string,
        value: string,
        options: Record<string, unknown>,
      ) => void;
    };
  },
  session: Session,
  token: string,
): Promise<void> {
  const secret = getSessionCacheSecret();
  if (!secret) {
    return;
  }

  const signed = await signCookie(
    serializeSession(session, await tokenFingerprint(token)),
    secret,
  );
  context.cookies.set(SESSION_CACHE_COOKIE, signed, {
    path: "/",
    httpOnly: true,
    sameSite: "strict",
    secure: import.meta.env.PROD,
    maxAge: 60,
  });
}

/**
 * CSP directives added to every response. Script/style hashes come from Astro's
 * own CSP (astro.config.mjs `security.csp`); these cover what it does not set,
 * notably frame-ancestors (clickjacking), which only works as a header.
 */
const EXTRA_CSP_DIRECTIVES = [
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "object-src 'none'",
];

/** Other security headers applied to every response. */
const SECURITY_HEADERS: Record<string, string> = {
  "X-Frame-Options": "DENY",
  "X-Content-Type-Options": "nosniff",
  "Referrer-Policy": "strict-origin-when-cross-origin",
  "Permissions-Policy":
    "camera=(), microphone=(), geolocation=(), payment=(), usb=()",
  "Cross-Origin-Opener-Policy": "same-origin",
};

export function applySecurityHeaders(response: Response, url: URL): Response {
  let target = response;
  try {
    target.headers.set("X-Content-Type-Options", "nosniff");
  } catch {
    // Headers of a passthrough fetch() response are immutable; copy it.
    target = new Response(response.body, response);
  }
  for (const [name, value] of Object.entries(SECURITY_HEADERS)) {
    if (!target.headers.has(name)) {
      target.headers.set(name, value);
    }
  }
  target.headers.set(
    "Content-Security-Policy",
    allowInlineStyles(
      mergeCspDirectives(
        target.headers.get("Content-Security-Policy"),
        EXTRA_CSP_DIRECTIVES,
      ),
    ),
  );
  if (url.protocol === "https:") {
    target.headers.set(
      "Strict-Transport-Security",
      "max-age=31536000; includeSubDomains",
    );
  }
  return target;
}

/**
 * Astro middleware: applies security headers to every response, and for admin
 * routes enforces body-size limits, CSRF origin checks, authentication and role
 * authorization. Operational routes (orders, products, categories, flavors,
 * addons) and the orders dashboard also accept manager/staff.
 */
export const onRequest = defineMiddleware(async (context, next) => {
  const response = await handleRequest(context, next);
  return applySecurityHeaders(response, context.url);
});

async function handleRequest(
  context: APIContext,
  next: MiddlewareNext,
): Promise<Response> {
  const { pathname } = context.url;

  // Skip non-admin routes (public pages, static assets, etc.)
  if (!isAdminApiRoute(pathname) && !isAdminPageRoute(pathname)) {
    return next();
  }

  // 1. Body-size gate (runs before any handler consumes the body).
  const bodySizeError = checkBodySize(context.request, pathname);
  if (bodySizeError) {
    return bodySizeError;
  }

  // 2. Origin check for state-changing requests.
  const originError = checkOrigin(context.request, context.url);
  if (originError) {
    return originError;
  }

  // 3. Authentication/authorization for protected admin routes.
  if (!isAuthExempt(pathname)) {
    const token = context.cookies.get("auth_token")?.value;
    if (!token) {
      return redirectToLogin(context.request);
    }

    let session: Session | null = await getCachedSession(context, token);
    if (!session) {
      try {
        session = await getSession(token);
      } catch {
        return redirectToLogin(context.request);
      }
    }

    if (!session || !session.active) {
      return redirectToLogin(context.request);
    }

    const staffAllowed = isAdminApiRoute(pathname)
      ? isStaffAllowedApiRoute(pathname)
      : STAFF_ALLOWED_PAGES.has(pathname);
    const allowedRoles: Session["role"][] = staffAllowed
      ? ["admin", "manager", "staff", "employee"]
      : ["admin"];
    const roleError = requireRole(session, allowedRoles);
    if (roleError) {
      // Pages redirect to the dashboard instead of showing raw JSON.
      if (!isAdminApiRoute(pathname)) {
        return new Response(null, {
          status: 302,
          headers: { Location: ADMIN_PAGE_ROOT, "Cache-Control": "no-store" },
        });
      }
      return roleError;
    }

    // Expose session on locals for downstream routes/pages.
    context.locals.session = session;

    // Refresh the short-lived signed session cache cookie.
    await setCachedSession(context, session, token);
  }

  return next();
}
