/**
 * API Error handling
 */

/**
 * Custom API error class
 */
export class ApiError extends Error {
  status: number;
  code: string;
  details?: Record<string, string[]>;

  constructor(
    message: string,
    status: number,
    code: string = "API_ERROR",
    details?: Record<string, string[]>,
  ) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
    this.details = details;
  }

  /**
   * Check if error is a specific code
   */
  isCode(code: string): boolean {
    return this.code === code;
  }

  /**
   * Check if error is client error (4xx)
   */
  isClientError(): boolean {
    return this.status >= 400 && this.status < 500;
  }

  /**
   * Check if error is server error (5xx)
   */
  isServerError(): boolean {
    return this.status >= 500;
  }

  /**
   * Check if error is network/connectivity issue
   */
  isNetworkError(): boolean {
    return this.status === 0 || this.code === "NETWORK_ERROR";
  }
}

/**
 * Validation error class
 */
export class ValidationError extends Error {
  fields: Record<string, string[]>;

  constructor(message: string, fields: Record<string, string[]>) {
    super(message);
    this.name = "ValidationError";
    this.fields = fields;
  }

  /**
   * Get error message for a specific field
   */
  getFieldError(field: string): string | undefined {
    return this.fields[field]?.[0];
  }

  /**
   * Get all field errors as a flat string
   */
  getAllErrors(): string {
    return Object.values(this.fields).flat().join(", ");
  }
}
