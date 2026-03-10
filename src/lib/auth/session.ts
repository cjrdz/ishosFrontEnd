/**
 * Authentication session utilities
 * 
 * Backend sets HttpOnly cookies on login, so we no longer rely on localStorage.
 * The cookie is sent automatically with every request.
 * 
 * This module handles session state on the frontend (optional fallback).
 */

import type { Session } from '../../types/auth';

/**
 * Store session data in memory (not localStorage)
 * This is used only as a cache of the current session for UI purposes.
 */
let cachedSession: Session | null = null;
let cachedToken: string | null = null;
const tokenKey = "ishos_admin_token";

/**
 * Get cached session from memory
 */
export function getCachedSession(): Session | null {
  return cachedSession;
}

/**
 * Set cached session in memory
 */
export function setCachedSession(session: Session | null): void {
  cachedSession = session;
}

/**
 * Clear cached session
 */
export function clearCachedSession(): void {
  cachedSession = null;
}

// Backward-compatible token helpers used by existing admin dashboard flows.
// The backend uses HttpOnly cookies, so these are DEPRECATED.
// New code should NOT use these functions - tokens are now handled via HttpOnly cookies automatically.
export function getToken(): string | null {
  if (typeof window !== "undefined") {
    const stored = localStorage.getItem(tokenKey);
    if (stored) {
      cachedToken = stored;
    }
  }
  return cachedToken;
}

export function setToken(token: string): void {
  cachedToken = token;
  if (typeof window !== "undefined") {
    localStorage.setItem(tokenKey, token);
  }
}

export function clearToken(): void {
  cachedToken = null;
  if (typeof window !== "undefined") {
    localStorage.removeItem(tokenKey);
  }
}

/**
 * Check if session exists (HttpOnly cookie will be sent by browser automatically)
 * This just checks if we have session data cached
 */
export function hasSession(): boolean {
  return cachedSession !== null;
}

/**
 * Get session email
 */
export function getSessionEmail(): string | null {
  return cachedSession?.email || null;
}

/**
 * Get session role
 */
export function getSessionRole(): string | null {
  return cachedSession?.role || null;
}

/**
 * Check if user is admin
 */
export function isAdmin(): boolean {
  return cachedSession?.role === 'admin';
}

/**
 * Check if user is manager or admin
 */
export function isManagerial(): boolean {
  return cachedSession?.role === 'admin' || cachedSession?.role === 'manager';
}
