/**
 * Authentication and authorization types
 */

/**
 * User role
 */
export type UserRole = "admin" | "manager" | "staff";

/**
 * Authenticated user/employee session
 */
export interface Session {
  id: string;
  email: string;
  name: string;
  phone: string;
  role: UserRole;
  active: boolean;
}

/**
 * Login request payload
 */
export interface LoginRequest {
  email: string;
  password: string;
}

/**
 * Login response from backend
 */
export interface LoginResponse {
  token: string;
  employee: Session;
}
