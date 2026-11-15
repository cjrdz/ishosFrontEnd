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

  it("is not re-signed on a cache hit", async () => {
    getSession.mockResolvedValue(ADMIN);
    const first = context("/api/admin/employees", {
      auth_token: "admin-token",
    });
    await run(first);
    const hit = context("/api/admin/employees", {
      auth_token: "admin-token",
      ishos_session_cache: first.setCookies.get("ishos_session_cache")!,
    });
    await run(hit);
    expect(hit.setCookies.has("ishos_session_cache")).toBe(false);
  });

  it("expires 60 seconds after the backend check, even if replayed", async () => {
    vi.useFakeTimers();
    try {
      vi.setSystemTime(new Date("2026-11-14T12:00:00Z"));
      getSession.mockResolvedValue(ADMIN);
      const first = context("/api/admin/employees", {
        auth_token: "admin-token",
      });
      await run(first);
      const cache = first.setCookies.get("ishos_session_cache")!;

      // The admin is demoted; the old cache must stop working after 60 s.
      vi.setSystemTime(new Date("2026-11-14T12:01:01Z"));
      getSession.mockClear();
      getSession.mockResolvedValue(STAFF);
      const { response } = await run(
        context("/api/admin/employees", {
          auth_token: "admin-token",
          ishos_session_cache: cache,
        }),
      );
      expect(getSession).toHaveBeenCalledWith("admin-token");
      expect(response.status).toBe(403);
    } finally {
      vi.useRealTimers();
    }
  });
});

describe("public store API", () => {
  it("rejects order bodies over 32 KiB before the route reads them", async () => {
    const { response, next } = await run(
      context(
        "/api/store/orders",
        {},
        {
          method: "POST",
          headers: { "Content-Length": String(40 * 1024) },
        },
      ),
    );
    expect(response.status).toBe(413);
    expect(next).not.toHaveBeenCalled();
  });

  it("lets normal checkout bodies and reads through", async () => {
    const small = await run(
      context(
        "/api/store/orders",
        {},
        {
          method: "POST",
          headers: { "Content-Length": "900" },
        },
      ),
    );
    expect(small.next).toHaveBeenCalled();
    const read = await run(context("/api/store/products"));
    expect(read.next).toHaveBeenCalled();
  });
});

describe("route matching", () => {
  it("matches whole path segments only", async () => {
    const { allowedRolesFor, matchesRoute } = await import("./middleware");
    expect(matchesRoute("/api/admin/orders", "/api/admin/orders")).toBe(true);
    expect(matchesRoute("/api/admin/orders/1", "/api/admin/orders")).toBe(true);
    expect(matchesRoute("/api/admin/ordersX", "/api/admin/orders")).toBe(false);
    // A look-alike route falls back to admin-only instead of staff access.
    expect(allowedRolesFor("/api/admin/ordersexport")).toEqual(["admin"]);
    expect(allowedRolesFor("/api/admin/orders/abc")).toContain("employee");
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
