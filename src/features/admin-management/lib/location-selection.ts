/**
 * The location (sucursal) the admin panel is working on.
 *
 * Admins pick one in the header (or "all"); the choice is stored in a cookie
 * the BFF forwards to the backend as X-Location-Id. Managers and employees are
 * always on their own location: the backend ignores the cookie for them.
 */

export const ADMIN_LOCATION_COOKIE = "ishos_admin_location";
export const ALL_LOCATIONS = "all";
export const LOCATION_CHANGE_EVENT = "ishos:location-change";

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Reads the admin's selection from document.cookie ("all" when unset). */
export function readSelectedLocation(cookieString?: string): string {
  const source =
    cookieString ?? (typeof document === "undefined" ? "" : document.cookie);
  for (const part of source.split(";")) {
    const [rawName, ...rest] = part.trim().split("=");
    if (rawName === ADMIN_LOCATION_COOKIE) {
      const value = decodeURIComponent(rest.join("="));
      return UUID_PATTERN.test(value) ? value.toLowerCase() : ALL_LOCATIONS;
    }
  }
  return ALL_LOCATIONS;
}

/** Stores the selection and tells open panels to reload their data. */
export function selectLocation(id: string): void {
  const value = UUID_PATTERN.test(id) ? id.toLowerCase() : ALL_LOCATIONS;
  const secure = location.protocol === "https:" ? "; Secure" : "";
  document.cookie = `${ADMIN_LOCATION_COOKIE}=${value}; Path=/; Max-Age=31536000; SameSite=Lax${secure}`;
  window.dispatchEvent(
    new CustomEvent(LOCATION_CHANGE_EVENT, { detail: { locationId: value } }),
  );
}

/**
 * The location actions apply to: the staff member's own, or the admin's
 * selection (null while an admin looks at "all" locations).
 */
export function effectiveLocationId(session: {
  role: string;
  location_id?: string | null;
}): string | null {
  if (session.role !== "admin") return session.location_id ?? null;
  const selected = readSelectedLocation();
  return selected === ALL_LOCATIONS ? null : selected;
}
