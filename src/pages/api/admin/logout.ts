/**
 * POST /api/admin/logout
 * Frontend logout endpoint (BFF layer)
 * 
 * Clears session cache and calls backend logout
 * Backend will clear HttpOnly cookie
 */

import type { APIRoute } from 'astro';
import { logout } from '../../../lib/api/auth';
import { clearCachedSession } from '../../../lib/auth/session';

export const prerender = false;

export const POST: APIRoute = async (context) => {
  try {
    // Clear cached session immediately
    clearCachedSession();

    // Clear same-origin auth cookie used by middleware.
    context.cookies.delete('auth_token', {
      path: '/',
    });

    // Call backend logout
    const response = await logout();

    return new Response(JSON.stringify(response), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-store',
      },
    });
  } catch (error) {
    // Even if backend logout fails, we've cleared the cache
    // Client should redirect to login
    clearCachedSession();
    context.cookies.delete('auth_token', {
      path: '/',
    });

    return new Response(
      JSON.stringify({
        message: 'Logged out',
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  }
};
