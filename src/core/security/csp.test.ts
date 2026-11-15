import { describe, expect, it } from "vitest";
import { allowInlineStyles, mergeCspDirectives } from "./csp";

describe("mergeCspDirectives", () => {
  it("appends missing directives to Astro's policy", () => {
    expect(
      mergeCspDirectives("default-src 'self'; script-src 'self' 'sha256-abc'", [
        "frame-ancestors 'none'",
        "object-src 'none'",
      ]),
    ).toBe(
      "default-src 'self'; script-src 'self' 'sha256-abc'; frame-ancestors 'none'; object-src 'none'",
    );
  });

  it("never overrides a directive that is already set", () => {
    expect(
      mergeCspDirectives("object-src 'self';", ["object-src 'none'"]),
    ).toBe("object-src 'self'");
  });

  it("builds a policy when none exists (dev / non-HTML responses)", () => {
    expect(mergeCspDirectives(null, ["frame-ancestors 'none'"])).toBe(
      "frame-ancestors 'none'",
    );
  });
});

describe("allowInlineStyles", () => {
  it("swaps style hashes for 'unsafe-inline' and leaves scripts hash-locked", () => {
    expect(
      allowInlineStyles(
        "default-src 'self'; script-src 'self' 'sha256-abc'; style-src 'self' https://fonts.googleapis.com 'sha256-def' 'sha256-ghi'",
      ),
    ).toBe(
      "default-src 'self'; script-src 'self' 'sha256-abc'; style-src 'self' https://fonts.googleapis.com 'unsafe-inline'",
    );
  });

  it("does not duplicate 'unsafe-inline' and leaves policies without styles alone", () => {
    expect(allowInlineStyles("style-src 'unsafe-inline'")).toBe(
      "style-src 'unsafe-inline'",
    );
    expect(allowInlineStyles("frame-ancestors 'none'")).toBe(
      "frame-ancestors 'none'",
    );
  });
});
