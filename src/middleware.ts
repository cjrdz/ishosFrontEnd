/**
 * Astro middleware for admin route protection
 * 
 * This middleware:
 * 1. Validates that admin routes have authentication
 * 2. Checks session validity
 * 3. Returns 401/403 for API endpoints, redirects for pages
 */

import { defineMiddleware } from 'astro:middleware';
import { getSession } from './lib/api/auth';

// Routes that require authentication
const protectedRoutes = ['/admin'];

// Routes that don't require authentication
const publicRoutes = ['/admin/login'];

export const onRequest = defineMiddleware(async (context, next) => {
  const { pathname } = context.url;

  // Check if this is a protected route
  const isProtectedRoute = protectedRoutes.some(route => pathname.startsWith(route));
  const isPublicRoute = publicRoutes.some(route => pathname.startsWith(route));

  // Skip middleware for public routes
  if (isPublicRoute) {
    return next();
  }

  // Check if protected route requires auth
  if (isProtectedRoute) {
    const authCookie = context.cookies.get('auth_token')?.value;

    // No session - redirect to login
    if (!authCookie) {
      if (pathname.startsWith('/api/')) {
        return new Response(
          JSON.stringify({ error: 'Unauthorized', code: 'UNAUTHORIZED' }),
          { status: 401, headers: { 'Content-Type': 'application/json' } }
        );
      }
      return context.redirect('/admin/login');
    }

    // Session cookie exists - verify token validity directly against backend.
    try {
      await getSession(authCookie);
      return next();
    } catch {
      context.cookies.delete('auth_token', { path: '/' });
      if (pathname.startsWith('/api/')) {
        return new Response(
          JSON.stringify({ error: 'Unauthorized', code: 'UNAUTHORIZED' }),
          {
            status: 401,
            headers: {
              'Content-Type': 'application/json',
              'Cache-Control': 'no-store',
            },
          }
        );
      }
      return context.redirect('/admin/login');
    }
  }

  // Not a protected route - continue
  return next();
});
