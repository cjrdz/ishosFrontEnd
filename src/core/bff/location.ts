import type { APIContext } from "astro";

/**
 * Cookie holding the location (sucursal) an admin is working on. The admin
 * header switcher sets it; "all" (or no cookie) means every location.
 * Managers and employees are fixed to their own location by the backend,
 * which ignores this value for them.
 */
export const ADMIN_LOCATION_COOKIE = "ishos_admin_location";

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Normalizes a cookie/query value to a location id or "all". */
export function parseLocationSelection(
  value: string | undefined | null,
): string {
  const trimmed = (value ?? "").trim();
  return UUID_PATTERN.test(trimmed) ? trimmed.toLowerCase() : "all";
}

/** Header telling the backend which location the admin is working on. */
export function locationHeaders(
  context: Pick<APIContext, "cookies">,
): Record<string, string> {
  const selected = parseLocationSelection(
    context.cookies.get(ADMIN_LOCATION_COOKIE)?.value,
  );
  return { "X-Location-Id": selected };
}
