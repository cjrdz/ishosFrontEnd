/**
 * GET /api/admin/employees
 * POST /api/admin/employees
 *
 * Backend forwarding endpoints for employee operations
 * Requires: auth_token HttpOnly cookie
 */

import type { APIRoute } from "astro";
import { employeeCreateSchema, parseJsonBody } from "@core/bff/validation";
import { proxyToBackend } from "@core/bff/proxy";

export const prerender = false;

export const GET: APIRoute = async (context) => {
  return proxyToBackend(context, "/employees");
};

export const POST: APIRoute = async (context) => {
  const parsed = await parseJsonBody(context, employeeCreateSchema);
  if (!parsed.success) {
    return parsed.response;
  }

  return proxyToBackend(context, "/employees", {
    method: "POST",
    body: parsed.data,
  });
};
