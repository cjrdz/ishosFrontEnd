/**
 * Authentication API calls to backend
 *
 * Note: Backend handles HttpOnly cookie setting on login.
 * No need to manually manage tokens here.
 */

import { apiRequest } from "./client";
import type { Session, LoginRequest, LoginResponse } from "../../types/auth";

/**
 * Login with email and password
 * Backend will set HttpOnly cookie automatically
 */
export async function login(
  email: string,
  password: string,
): Promise<LoginResponse> {
  return apiRequest<LoginResponse>("/auth/login", {
    method: "POST",
    body: { email, password } as LoginRequest,
  });
}

/**
 * Get current session information
 * Requires valid HttpOnly cookie or Bearer token
 */
export async function getSession(token?: string): Promise<Session> {
  return apiRequest<Session>("/auth/session", {
    method: "GET",
    token,
  });
}

/**
 * Logout current session
 * Backend will clear the HttpOnly cookie
 */
export async function logout(token?: string): Promise<{ message: string }> {
  return apiRequest<{ message: string }>("/auth/logout", {
    method: "POST",
    token,
  });
}
