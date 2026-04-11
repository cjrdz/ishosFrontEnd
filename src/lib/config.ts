const defaultApiBaseUrl = "http://localhost:8080/api/v1";
const productionApiBaseUrl = "https://ishosbackend.onrender.com/api/v1";
const defaultAuthCookieTTLHours = 24;

function parsePositiveInt(raw: string | undefined, fallback: number): number {
  if (!raw) return fallback;
  const parsed = Number.parseInt(raw, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return fallback;
  }
  return parsed;
}

export function getApiBaseUrl(): string {
  const value = import.meta.env.PUBLIC_API_BASE_URL;
  if (!value || typeof value !== "string") {
    return import.meta.env.PROD ? productionApiBaseUrl : defaultApiBaseUrl;
  }
  return value.replace(/\/$/, "");
}

export function getAuthCookieTTLSeconds(): number {
  const ttlHours = parsePositiveInt(
    import.meta.env.PUBLIC_AUTH_COOKIE_TTL_HOURS,
    defaultAuthCookieTTLHours,
  );
  return ttlHours * 60 * 60;
}
