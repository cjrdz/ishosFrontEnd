/**
 * Validation schemas for admin-related API inputs
 * Using Zod for runtime validation
 */

import { z } from "zod";

/**
 * Validate login credentials
 */
export const LoginSchema = z.object({
  email: z.string().email("Invalid email address"),
  password: z.string().min(6, "Password must be at least 6 characters"),
});

export type LoginInput = z.infer<typeof LoginSchema>;
