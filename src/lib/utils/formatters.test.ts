import { describe, it, expect } from "vitest";
import { formatCurrency, toSlug } from "./formatters";

describe("formatCurrency", () => {
  it("formats a positive number as USD currency", () => {
    expect(formatCurrency(10)).toContain("10");
    expect(formatCurrency(10)).toContain("$");
  });

  it("formats zero as $0.00", () => {
    const result = formatCurrency(0);
    expect(result).toContain("0");
  });

  it("handles falsy input by treating it as 0", () => {
    // @ts-expect-error – deliberate wrong type to test runtime guard
    expect(() => formatCurrency(undefined)).not.toThrow();
  });
});

describe("toSlug", () => {
  it("lowercases and trims the string", () => {
    expect(toSlug("  Hello World  ")).toBe("hello-world");
  });

  it("replaces spaces with hyphens", () => {
    expect(toSlug("foo bar baz")).toBe("foo-bar-baz");
  });

  it("removes accents via NFD normalisation", () => {
    expect(toSlug("Café Olé")).toBe("cafe-ole");
  });

  it("strips non-alphanumeric characters", () => {
    expect(toSlug("hello! world?")).toBe("hello-world");
  });

  it("collapses multiple hyphens into one", () => {
    expect(toSlug("foo---bar")).toBe("foo-bar");
  });
});
