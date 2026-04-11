/**
 * POST /api/auth/login
 * Frontend login endpoint (BFF layer)
 * 
 * Request body: { email: string, password: string }
 * Response: { token: string, employee: Session }
 * 
 * Note: Backend sends HttpOnly cookie, this endpoint just proxies the request
 */

import type { APIRoute } from 'astro';
import { login } from '../../../lib/api/auth';
import { LoginSchema } from '../../../lib/validators/admin';

export const prerender = false;

function buildAuthCookie(token: string, isSecure: boolean): string {
  const parts = [
    `auth_token=${encodeURIComponent(token)}`,
    'Path=/',
    'HttpOnly',
    'SameSite=Lax',
    `Max-Age=${60 * 60 * 24}`,
  ];

  if (isSecure) {
    parts.push('Secure');
  }

  return parts.join('; ');
}

export const POST: APIRoute = async (context) => {
  try {
    // Parse and validate request body
    const body = await context.request.json();
    const validated = LoginSchema.parse(body);

    // Call backend login
    const response = await login(validated.email, validated.password);

    const forwardedProto = context.request.headers.get('x-forwarded-proto');
    const isSecure = (forwardedProto ?? context.url.protocol.replace(':', '')) === 'https';

    // Set same-origin HttpOnly cookie so Astro middleware can validate /admin routes.
    context.cookies.set('auth_token', response.token, {
      path: '/',
      httpOnly: true,
      sameSite: 'lax',
      secure: isSecure,
      maxAge: 60 * 60 * 24,
    });

    // Return response with explicit Set-Cookie for edge/runtime consistency.
    return new Response(JSON.stringify(response), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-store, no-cache, must-revalidate, private',
        'Pragma': 'no-cache',
        'Expires': '0',
        'Set-Cookie': buildAuthCookie(response.token, isSecure),
      },
    });
  } catch (error) {
    if (error instanceof Error) {
      if (error.message.includes('validation')) {
        return new Response(
          JSON.stringify({
            error: 'Validation error',
            code: 'VALIDATION_ERROR',
            message: error.message,
          }),
          {
            status: 400,
            headers: {
              'Content-Type': 'application/json',
              'Cache-Control': 'no-store',
            },
          }
        );
      }

      return new Response(
        JSON.stringify({
          error: error.message || 'Login failed',
          code: 'LOGIN_ERROR',
        }),
        {
          status: 401,
          headers: {
            'Content-Type': 'application/json',
            'Cache-Control': 'no-store',
          },
        }
      );
    }

    return new Response(
      JSON.stringify({
        error: 'Internal server error',
        code: 'SERVER_ERROR',
      }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
};
