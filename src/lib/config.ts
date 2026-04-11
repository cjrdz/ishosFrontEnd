const defaultApiBaseUrl = "http://localhost:8080/api/v1";
const productionApiBaseUrl = "https://ishosbackend.onrender.com/api/v1";

export function getApiBaseUrl(): string {
  const value = import.meta.env.PUBLIC_API_BASE_URL;
  if (!value || typeof value !== "string") {
    return import.meta.env.PROD ? productionApiBaseUrl : defaultApiBaseUrl;
  }
  return value.replace(/\/$/, "");
}
