/**
 * Shared types used across both store and admin interfaces
 */

/**
 * Standard API response wrapper
 */
export type ApiResponse<T> =
  | {
      success: true;
      data: T;
    }
  | {
      success: false;
      error: {
        code: string;
        message: string;
      };
    };

/**
 * Paginated API response
 */
export type PaginatedResult<T> = {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
};

/**
 * Authentication token stored in headers/cookies
 */
export interface AuthToken {
  jwt: string;
  expiresAt?: number;
}

/**
 * Generic error response from API
 */
export interface ApiErrorResponse {
  error: string;
  code?: string;
  details?: Record<string, string[]>;
}
