/**
 * POST /api/admin/logout
 * Frontend logout endpoint (BFF layer)
 *
 * Clears session cache and calls backend logout
 * Backend will clear HttpOnly cookie
 */

import type { APIRoute } from "astro";
import { logout } from "../../../lib/api/auth";
import { clearCachedSession } from "../../../lib/auth/session";

export const prerender = false;

function buildLogoutCookie(isSecure: boolean): string {
  const parts = [
    "auth_token=",
    "Path=/",
    "HttpOnly",
    "SameSite=Lax",
    "Max-Age=0",
    "Expires=Thu, 01 Jan 1970 00:00:00 GMT",
  ];

  if (isSecure) {
    parts.push("Secure");
  }

  return parts.join("; ");
}

export const POST: APIRoute = async (context) => {
  try {
    const token = context.cookies.get("auth_token")?.value;

    const forwardedProto = context.request.headers.get("x-forwarded-proto");
    const isSecure =
      (forwardedProto ?? context.url.protocol.replace(":", "")) === "https";

    // Clear cached session immediately
    clearCachedSession();

    // Clear same-origin auth cookie used by middleware.
    context.cookies.delete("auth_token", {
      path: "/",
    });

    // Call backend logout
    const response = await logout(token);

    return new Response(JSON.stringify(response), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": "no-store",
        "Set-Cookie": buildLogoutCookie(isSecure),
      },
    });
  } catch (error) {
    // Even if backend logout fails, we've cleared the cache
    // Client should redirect to login
    clearCachedSession();
    context.cookies.delete("auth_token", {
      path: "/",
    });

    return new Response(
      JSON.stringify({
        message: "Logged out",
      }),
      {
        status: 200,
        headers: {
          "Content-Type": "application/json",
          "Set-Cookie": buildLogoutCookie(true),
        },
      },
    );
  }
};
