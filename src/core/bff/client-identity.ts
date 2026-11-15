/**
 * Client identity headers for BFF → backend calls.
 *
 * Every browser request reaches the Go backend through this BFF, so the backend
 * would otherwise see the Worker's egress IP for all customers and apply its
 * per-IP rate limits (orders, tracking, login) store-wide. The BFF forwards the
 * end user's IP in X-Client-IP, and proves the header is trustworthy with a
 * shared secret in X-BFF-Secret (BFF_SHARED_SECRET on both services).
 *
 * This module is pure (no astro:env import) so it can be unit tested.
 */

export const BFF_SECRET_HEADER = "X-BFF-Secret";
export const CLIENT_IP_HEADER = "X-Client-IP";

// Loose IPv4/IPv6 shape check; the backend parses the value strictly.
const IP_PATTERN = /^[0-9a-fA-F:.]{2,45}$/;

export type BffPlatform = "cloudflare" | "other";

/**
 * Detects the runtime: Cloudflare Workers report this exact user agent.
 */
export function detectPlatform(): BffPlatform {
  return typeof navigator !== "undefined" &&
    navigator.userAgent === "Cloudflare-Workers"
    ? "cloudflare"
    : "other";
}

/**
 * Resolves the end user's IP from the one header the platform sets itself:
 * CF-Connecting-IP on Cloudflare (overwritten by Cloudflare), X-Real-IP
 * elsewhere (set by Vercel). Any other copy of those headers comes from the
 * client and could be forged, as could X-Forwarded-For, which is never used.
 * Falls back to the adapter's clientAddress.
 */
export function resolveClientIp(
  request: Request,
  clientAddress?: () => string,
  platform: BffPlatform = detectPlatform(),
): string | null {
  const candidates = [
    request.headers.get(
      platform === "cloudflare" ? "cf-connecting-ip" : "x-real-ip",
    ),
  ];
  for (const candidate of candidates) {
    const value = candidate?.trim();
    if (value && IP_PATTERN.test(value)) {
      return value;
    }
  }

  if (clientAddress) {
    try {
      const value = clientAddress().trim();
      if (IP_PATTERN.test(value)) {
        return value;
      }
    } catch {
      // Some adapters throw when the address is unavailable.
    }
  }
  return null;
}

/**
 * Builds the identity headers to add to an upstream request. Returns no headers
 * when the secret is not configured: without it the backend ignores
 * X-Client-IP anyway.
 */
export function buildClientIdentityHeaders(
  request: Request,
  secret: string | undefined,
  clientAddress?: () => string,
  platform: BffPlatform = detectPlatform(),
): Record<string, string> {
  if (!secret) {
    return {};
  }
  const headers: Record<string, string> = { [BFF_SECRET_HEADER]: secret };
  const ip = resolveClientIp(request, clientAddress, platform);
  if (ip) {
    headers[CLIENT_IP_HEADER] = ip;
  }
  return headers;
}
