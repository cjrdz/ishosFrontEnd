/**
 * Authentication and authorization types
 */

/**
 * User role
 */
export type UserRole = "admin" | "manager" | "staff" | "employee";

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
  /** Location (sucursal) the employee works at; null for admins. */
  location_id?: string | null;
  location_name?: string | null;
  /** Inactivity logout (seconds) configured by the admin. */
  inactivity_logout_seconds?: number;
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
  employee: Session;
}
