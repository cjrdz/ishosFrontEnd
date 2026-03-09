/**
 * Route guards for protected pages
 */

import type { APIContext } from 'astro';
import { getCachedSession, isAdmin, isManagerial } from '../auth/session';

/**
 * Guard that requires authentication
 * Redirects to login if not authenticated
 */
export async function requireAuth(context: APIContext): Promise<void> {
  const session = getCachedSession();
  if (!session) {
    return context.redirect('/admin/login');
  }
}

/**
 * Guard that requires admin role
 * Redirects to login if not authenticated or not admin
 */
export async function requireAdmin(context: APIContext): Promise<void> {
  await requireAuth(context);
  if (!isAdmin()) {
    return context.redirect('/admin/login');
  }
}

/**
 * Guard that requires manager or admin role
 * Redirects to login if not authenticated or insufficient role
 */
export async function requireManagerial(context: APIContext): Promise<void> {
  await requireAuth(context);
  if (!isManagerial()) {
    return context.redirect('/admin/login');
  }
}
