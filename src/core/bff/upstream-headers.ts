/**
 * Runtime wrapper around buildClientIdentityHeaders that reads
 * BFF_SHARED_SECRET via astro:env, which resolves secrets at request time
 * (Cloudflare Worker env / process.env) instead of inlining them at build time.
 */

import type { APIContext } from "astro";
import { getSecret } from "astro:env/server";
import { buildClientIdentityHeaders } from "./client-identity";

export function clientIdentityHeaders(
  context: Pick<APIContext, "request" | "clientAddress">,
): Record<string, string> {
  return buildClientIdentityHeaders(
    context.request,
    getSecret("BFF_SHARED_SECRET"),
    () => context.clientAddress,
  );
}
