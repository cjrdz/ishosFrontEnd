/**
 * API client for backend communication
 *
 * Supports both HttpOnly cookie auth and Bearer token fallback.
 */

import { getApiBaseUrl } from "../config";
import { ApiError } from "../errors";

export { ApiError };

interface RequestOptions {
  method?: "GET" | "POST" | "PATCH" | "DELETE" | "PUT";
  body?: unknown;
  headers?: Record<string, string>;
  token?: string;
  timeoutMs?: number;
}

export async function apiRequest<T>(
  path: string,
  options: RequestOptions = {},
): Promise<T> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...options.headers,
  };

  if (options.token) {
    headers.Authorization = `Bearer ${options.token}`;
  }

  const controller = new AbortController();
  const timeoutMs = options.timeoutMs ?? 12000;
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  const url = `${getApiBaseUrl()}${path}`;

  let response: Response;
  try {
    response = await fetch(url, {
      method: options.method ?? "GET",
      headers,
      body: options.body ? JSON.stringify(options.body) : undefined,
      credentials: "include",
      signal: controller.signal,
    });
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") {
      throw new ApiError("Request timed out", 504, "TIMEOUT");
    }
    throw new ApiError("Network request failed", 0, "NETWORK_ERROR");
  } finally {
    clearTimeout(timeout);
  }

  if (!response.ok) {
    let message = "Request failed";
    let code = "API_ERROR";
    try {
      const payload = (await response.json()) as {
        error?: string;
        message?: string;
        code?: string;
      };
      message = payload.error ?? payload.message ?? message;
      code = payload.code ?? code;
    } catch {
      message = response.statusText || message;
    }
    throw new ApiError(message, response.status, code);
  }

  return (await response.json()) as T;
}
