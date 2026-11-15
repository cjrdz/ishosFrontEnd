import { describe, expect, it } from "vitest";
import {
  BFF_SECRET_HEADER,
  CLIENT_IP_HEADER,
  buildClientIdentityHeaders,
  resolveClientIp,
} from "./client-identity";

function request(headers: Record<string, string>): Request {
  return new Request("https://store.example.com/api/store/orders", { headers });
}

describe("resolveClientIp", () => {
  const both = {
    "cf-connecting-ip": "203.0.113.7",
    "x-real-ip": "198.51.100.1",
  };

  it("uses CF-Connecting-IP on Cloudflare", () => {
    expect(resolveClientIp(request(both), undefined, "cloudflare")).toBe(
      "203.0.113.7",
    );
  });

  it("ignores a client-sent CF-Connecting-IP off Cloudflare (e.g. Vercel)", () => {
    expect(resolveClientIp(request(both), undefined, "other")).toBe(
      "198.51.100.1",
    );
    expect(
      resolveClientIp(
        request({ "cf-connecting-ip": "6.6.6.6" }),
        undefined,
        "other",
      ),
    ).toBeNull();
  });

  it("ignores client-controlled X-Forwarded-For", () => {
    expect(
      resolveClientIp(request({ "x-forwarded-for": "6.6.6.6" })),
    ).toBeNull();
  });

  it("falls back to the adapter's clientAddress", () => {
    expect(resolveClientIp(request({}), () => "::1")).toBe("::1");
  });

  it("rejects malformed values and tolerates throwing clientAddress", () => {
    expect(
      resolveClientIp(request({ "x-real-ip": "1.2.3.4, <script>" }), () => {
        throw new Error("unavailable");
      }),
    ).toBeNull();
  });
});

describe("buildClientIdentityHeaders", () => {
  it("sends the secret and client IP when configured", () => {
    expect(
      buildClientIdentityHeaders(
        request({ "cf-connecting-ip": "203.0.113.7" }),
        "s3cret",
        undefined,
        "cloudflare",
      ),
    ).toEqual({
      [BFF_SECRET_HEADER]: "s3cret",
      [CLIENT_IP_HEADER]: "203.0.113.7",
    });
  });

  it("sends nothing without a secret", () => {
    expect(
      buildClientIdentityHeaders(
        request({ "cf-connecting-ip": "203.0.113.7" }),
        undefined,
      ),
    ).toEqual({});
  });
});
