/**
 * GET /api/admin/session
 * Frontend session endpoint (BFF layer)
 *
 * Returns current authenticated user session
 * Requires valid HttpOnly cookie
 */

import type { APIRoute } from "astro";
import { getSession } from "@features/auth";

export const prerender = false;

export const GET: APIRoute = async (context) => {
  try {
    // Forward same-origin auth cookie token to backend auth/session
    const token = context.cookies.get("auth_token")?.value;

    const session = await getSession(token);

    return new Response(JSON.stringify(session), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": "no-store, no-cache, must-revalidate, private",
        Pragma: "no-cache",
        Expires: "0",
      },
    });
  } catch (error) {
    if (error instanceof Error) {
      return new Response(
        JSON.stringify({
          error: error.message || "Session fetch failed",
          code: "SESSION_ERROR",
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
        error: "Internal server error",
        code: "SERVER_ERROR",
      }),
      {
        status: 500,
        headers: {
          "Content-Type": "application/json",
          "Cache-Control": "no-store",
        },
      },
    );
  }
};
