/**
 * Runtime wrapper around buildClientIdentityHeaders that reads
 * BFF_SHARED_SECRET via astro:env, which resolves secrets at request time
 * (Cloudflare Worker env / process.env) instead of inlining them at build time.
 */

import type { APIContext } from "astro";
import { getSecret } from "astro:env/server";
import { buildClientIdentityHeaders } from "./client-identity";

let warnedMissingSecret = false;

export function clientIdentityHeaders(
  context: Pick<APIContext, "request" | "clientAddress">,
): Record<string, string> {
  const secret = getSecret("BFF_SHARED_SECRET");
  if (!secret && import.meta.env.PROD && !warnedMissingSecret) {
    // Without it the backend sees every customer as the Worker's IP, so one
    // client can trip the login lockout and order rate limits for everyone.
    // Logged (once per isolate) rather than failing closed, so a missing
    // secret at deploy time degrades rate limiting instead of the store.
    warnedMissingSecret = true;
    console.error(
      "[bff] BFF_SHARED_SECRET is not set: per-client rate limits are disabled. Set it on the Worker and the backend.",
    );
  }
  return buildClientIdentityHeaders(
    context.request,
    secret,
    () => context.clientAddress,
  );
}
