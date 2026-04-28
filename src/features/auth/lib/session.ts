/**
 * Authentication session utilities
 *
 * Backend sets HttpOnly cookies on login. This module only caches
 * session data in the browser runtime for UI state.
 */

import type { Session } from "../../../types/auth";

/**
 * Store session data in memory (not localStorage)
 * This is used only as a cache of the current session for UI purposes.
 */
let cachedSession: Session | null = null;

/**
 * Get cached session from memory
 */
export function getCachedSession(): Session | null {
  if (typeof window === "undefined") {
    return null;
  }
  return cachedSession;
}

/**
 * Set cached session in memory
 */
export function setCachedSession(session: Session | null): void {
  if (typeof window === "undefined") {
    return;
  }
  cachedSession = session;
}

/**
 * Clear cached session
 */
export function clearCachedSession(): void {
  if (typeof window === "undefined") {
    return;
  }
  cachedSession = null;
}

/**
 * Check if session exists (HttpOnly cookie will be sent by browser automatically)
 * This just checks if we have session data cached
 */
export function hasSession(): boolean {
  return getCachedSession() !== null;
}

/**
 * Get session email
 */
export function getSessionEmail(): string | null {
  return getCachedSession()?.email || null;
}

/**
 * Get session role
 */
export function getSessionRole(): string | null {
  return getCachedSession()?.role || null;
}

/**
 * Check if user is admin
 */
export function isAdmin(): boolean {
  return getCachedSession()?.role === "admin";
}

/**
 * Check if user is manager or admin
 */
export function isManagerial(): boolean {
  const role = getCachedSession()?.role;
  return role === "admin" || role === "manager";
}
