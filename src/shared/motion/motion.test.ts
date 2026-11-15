import { afterEach, describe, expect, it, vi } from "vitest";
import { bump, celebrate, enter, safeAnimate } from "./motion";

function setReducedMotion(reduce: boolean) {
  window.matchMedia = vi.fn().mockReturnValue({
    matches: reduce,
  }) as unknown as typeof window.matchMedia;
}

afterEach(() => vi.restoreAllMocks());

describe("safeAnimate", () => {
  it("applies the final frame immediately with reduced motion", async () => {
    setReducedMotion(true);
    const el = document.createElement("div");
    el.style.opacity = "0";
    await enter(el);
    expect(el.style.opacity).toBe("1");
    expect(el.style.transform).toBe("none");
  });

  it("applies the final frame when the Web Animations API is missing", async () => {
    setReducedMotion(false);
    const el = document.createElement("div"); // jsdom has no element.animate
    await safeAnimate(el, [{ opacity: 0 }, { opacity: 0.5 }]);
    expect(el.style.opacity).toBe("0.5");
  });

  it("lands on the final frame even if the animation is interrupted", async () => {
    setReducedMotion(false);
    const el = document.createElement("div");
    const cancel = vi.fn();
    el.animate = vi.fn().mockReturnValue({
      finished: Promise.reject(new DOMException("aborted", "AbortError")),
      cancel,
    }) as unknown as typeof el.animate;
    await bump(el);
    expect(el.style.transform).toBe("scale(1)");
    expect(cancel).toHaveBeenCalled();
  });
});

describe("celebrate", () => {
  it("adds nothing to the page with reduced motion", () => {
    setReducedMotion(true);
    const before = document.body.childElementCount;
    celebrate(document.body);
    expect(document.body.childElementCount).toBe(before);
  });

  it("leaves no pieces behind without the Web Animations API", () => {
    setReducedMotion(false);
    const before = document.body.childElementCount;
    celebrate(document.body);
    expect(document.body.childElementCount).toBe(before);
  });
});
