import type { APIContext } from "astro";
import type { Session } from "../../types/auth";

function jsonResponse(body: Record<string, unknown>, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "no-store",
    },
  });
}

/**
 * Require the caller to be an authenticated admin.
 *
 * Use this inside handlers for operations that should be admin-only even when
 * the route prefix is otherwise open to manager/staff roles (e.g. deletes).
 */
export function requireAdmin(context: APIContext): Response | null {
  const session = context.locals.session as Session | undefined;
  if (!session || session.role !== "admin") {
    return jsonResponse(
      { error: "Forbidden", code: "INSUFFICIENT_PRIVILEGES" },
      403,
    );
  }
  return null;
}

/**
 * Require the caller to have one of the allowed roles.
 */
export function requireRole(
  context: APIContext,
  allowedRoles: readonly Session["role"][],
): Response | null {
  const session = context.locals.session as Session | undefined;
  if (!session || !allowedRoles.includes(session.role)) {
    return jsonResponse(
      { error: "Forbidden", code: "INSUFFICIENT_PRIVILEGES" },
      403,
    );
  }
  return null;
}
