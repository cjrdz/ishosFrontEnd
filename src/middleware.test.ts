// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Session } from "./types/auth";

const getSession = vi.fn<(token?: string) => Promise<Session>>();
vi.mock("@features/auth", () => ({
  getSession: (token?: string) => getSession(token),
}));

const { onRequest } = await import("./middleware");
const { setTestSecret } = await import("./test/astro-env-server.stub");

const ADMIN: Session = {
  id: "a1",
  email: "admin@x.sv",
  name: "Admin",
  role: "admin",
  active: true,
  phone: "",
};
const STAFF: Session = {
  id: "s1",
  email: "staff@x.sv",
  name: "Staff",
  role: "employee",
  active: true,
  phone: "",
};

/** Minimal Astro context: URL, request, a cookie jar and locals. */
function context(
  path: string,
  cookies: Record<string, string> = {},
  init: RequestInit = {},
) {
  const url = new URL(`https://store.example${path}`);
  const jar = new Map(Object.entries(cookies));
  const setCookies = new Map<string, string>();
  return {
    url,
    request: new Request(url, init),
    locals: {} as Record<string, unknown>,
    cookies: {
      get: (name: string) =>
        jar.has(name) ? { value: jar.get(name) } : undefined,
      set: (name: string, value: string) => {
        setCookies.set(name, value);
        jar.set(name, value);
      },
      delete: (name: string) => {
        jar.delete(name);
      },
    },
    setCookies,
  };
}

async function run(ctx: ReturnType<typeof context>) {
  const next = vi.fn(async () => new Response("page", { status: 200 }));
  // The stubbed defineMiddleware returns the handler itself.
  const handler = onRequest as unknown as (
    c: unknown,
    n: () => Promise<Response>,
  ) => Promise<Response>;
  const response = await handler(ctx, next);
  return { response, next };
}

beforeEach(() => {
  getSession.mockReset();
  setTestSecret("SESSION_CACHE_SECRET", "test-session-cache-secret-0123456789");
});

describe("admin page guard", () => {
  it.each(["/admin", "/admin/", "/admin/settings"])(
    "redirects anonymous %s to login",
    async (path) => {
      const { response, next } = await run(context(path));
      expect(response.status).toBe(302);
      expect(response.headers.get("Location")).toBe("/admin/login");
      expect(next).not.toHaveBeenCalled();
    },
  );

  it("lets staff open the orders dashboard", async () => {
    getSession.mockResolvedValue(STAFF);
    const { response, next } = await run(
      context("/admin", { auth_token: "staff-token" }),
    );
    expect(next).toHaveBeenCalled();
    expect(response.status).toBe(200);
  });

  it("redirects staff away from admin-only pages instead of showing JSON", async () => {
    getSession.mockResolvedValue(STAFF);
    const { response, next } = await run(
      context("/admin/settings", { auth_token: "staff-token" }),
    );
    expect(response.status).toBe(302);
    expect(response.headers.get("Location")).toBe("/admin");
    expect(next).not.toHaveBeenCalled();
  });

  it("returns 403 JSON for staff on admin-only API routes", async () => {
    getSession.mockResolvedValue(STAFF);
    const { response } = await run(
      context("/api/admin/employees", { auth_token: "staff-token" }),
    );
    expect(response.status).toBe(403);
    expect(await response.json()).toMatchObject({
      code: "INSUFFICIENT_PRIVILEGES",
    });
  });
});

describe("session cache", () => {
  it("is ignored when presented with a different auth token", async () => {
    // An admin request issues a signed cache cookie bound to the admin token.
    getSession.mockResolvedValue(ADMIN);
    const adminCtx = context("/api/admin/employees", {
      auth_token: "admin-token",
    });
    await run(adminCtx);
    const adminCache = adminCtx.setCookies.get("ishos_session_cache");
    expect(adminCache).toBeTruthy();

    // A staff token paired with the admin's cache must fall back to the backend.
    getSession.mockResolvedValue(STAFF);
    const { response } = await run(
      context("/api/admin/employees", {
        auth_token: "staff-token",
        ishos_session_cache: adminCache!,
      }),
    );
    expect(getSession).toHaveBeenLastCalledWith("staff-token");
    expect(response.status).toBe(403);
  });

  it("is reused for the same token without calling the backend", async () => {
    getSession.mockResolvedValue(ADMIN);
    const first = context("/api/admin/employees", {
      auth_token: "admin-token",
    });
    await run(first);
    getSession.mockClear();
    const { response } = await run(
      context("/api/admin/employees", {
        auth_token: "admin-token",
        ishos_session_cache: first.setCookies.get("ishos_session_cache")!,
      }),
    );
    expect(getSession).not.toHaveBeenCalled();
    expect(response.status).toBe(200);
  });
});

describe("security headers", () => {
  it("adds clickjacking protection and merges directives into an existing CSP", async () => {
    const ctx = context("/menu");
    const next = vi.fn(
      async () =>
        new Response("x", {
          headers: {
            "Content-Security-Policy":
              "default-src 'self'; style-src 'self' 'sha256-abc'",
          },
        }),
    );
    const handler = onRequest as unknown as (
      c: unknown,
      n: () => Promise<Response>,
    ) => Promise<Response>;
    const response = await handler(ctx, next);
    const csp = response.headers.get("Content-Security-Policy") ?? "";
    expect(csp).toContain("frame-ancestors 'none'");
    expect(csp).toContain("style-src 'self' 'unsafe-inline'");
    expect(csp).not.toContain("sha256-abc");
    expect(response.headers.get("X-Frame-Options")).toBe("DENY");
    expect(response.headers.get("Strict-Transport-Security")).toContain(
      "max-age=",
    );
  });
});
