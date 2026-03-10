/**
 * BFF proxy utility for forwarding authenticated requests to backend
 *
 * This handles:
 * - Token extraction from HttpOnly cookies
 * - Request proxying with authentication
 * - Error handling and response forwarding
 */

import type { APIContext } from 'astro';
import { getApiBaseUrl } from '../config';

export interface ProxyOptions {
  method?: 'GET' | 'POST' | 'PATCH' | 'DELETE' | 'PUT';
  body?: unknown;
  query?: Record<string, string | number | boolean>;
  isFormData?: boolean;
}

export interface ProxyFormDataOptions extends Omit<ProxyOptions, 'body'> {
  isFormData: true;
  body: FormData;
}

export async function proxyToBackend(
  context: APIContext,
  path: string,
  options: ProxyOptions | ProxyFormDataOptions = {},
): Promise<Response> {
  const token = context.cookies.get('auth_token')?.value;

  if (!token) {
    return new Response(
      JSON.stringify({ error: 'Unauthorized', code: 'UNAUTHORIZED' }),
      { status: 401, headers: { 'Content-Type': 'application/json' } }
    );
  }

  const headers: Record<string, string> = {
    Authorization: `Bearer ${token}`,
  };

  // Only set Content-Type for non-FormData requests
  if (!options.isFormData) {
    headers['Content-Type'] = 'application/json';
  }

  const url = new URL(`${getApiBaseUrl()}${path}`);
  if (options.query) {
    Object.entries(options.query).forEach(([key, value]) => {
      url.searchParams.set(key, String(value));
    });
  }

  try {
    const response = await fetch(url.toString(), {
      method: options.method ?? 'GET',
      headers,
      body:
        options.isFormData && options.body instanceof FormData
          ? (options.body as FormData)
          : options.body
          ? JSON.stringify(options.body)
          : undefined,
    });

    const contentType = response.headers.get('content-type')?.toLowerCase() ?? '';
    let data: unknown;

    if (contentType.includes('application/json')) {
      data = await response.json();
    } else {
      const rawText = await response.text();
      const trimmedText = rawText.trim();

      if (trimmedText.startsWith('{') || trimmedText.startsWith('[')) {
        try {
          data = JSON.parse(trimmedText);
        } catch {
          data = response.ok
            ? { message: trimmedText || 'OK' }
            : { error: trimmedText || 'Request failed' };
        }
      } else {
        data = response.ok
          ? { message: trimmedText || 'OK' }
          : { error: trimmedText || 'Request failed' };
      }
    }

    return new Response(JSON.stringify(data), {
      status: response.status,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-store, no-cache, must-revalidate, private',
        'Pragma': 'no-cache',
        'Expires': '0',
      },
    });
  } catch (error) {
    console.error('Backend proxy error:', error);
    return new Response(
      JSON.stringify({ error: 'Backend request failed', code: 'BACKEND_ERROR' }),
      { status: 502, headers: { 'Content-Type': 'application/json' } }
    );
  }
}
