import { apiRequest } from "./client";

export interface EmployeeSession {
  id: string;
  email: string;
  name: string;
  phone: string;
  role: "admin" | "employee";
  active?: boolean;
}

interface LoginResponse {
  token: string;
  employee: EmployeeSession;
}

export async function login(email: string, password: string): Promise<LoginResponse> {
  return apiRequest<LoginResponse>("/auth/login", {
    method: "POST",
    body: { email, password },
  });
}

export async function getSession(token: string): Promise<EmployeeSession> {
  return apiRequest<EmployeeSession>("/auth/session", {
    token,
  });
}

export async function logout(token: string): Promise<{ message: string }> {
  return apiRequest<{ message: string }>("/auth/logout", {
    method: "POST",
    token,
  });
}
