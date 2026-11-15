/**
 * Motion helpers. Every animation lands on its final keyframe as inline style,
 * so content is never left hidden: with prefers-reduced-motion, without the
 * Web Animations API, or if an animation is interrupted, the element jumps to
 * the end state. Durations and easing match the CSS tokens in global.css.
 */

export const DURATION = { fast: 150, panel: 250, enter: 400 } as const;
export const EASE_OUT = "cubic-bezier(0.22, 1, 0.36, 1)";

export function prefersReducedMotion(): boolean {
  return (
    typeof window !== "undefined" &&
    typeof window.matchMedia === "function" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
}

type StyleFrame = Partial<Record<string, string | number>>;

function applyFrame(el: HTMLElement, frame: StyleFrame): void {
  for (const [property, value] of Object.entries(frame)) {
    if (property === "offset" || property === "easing" || value == null)
      continue;
    el.style.setProperty(
      property.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`),
      String(value),
    );
  }
}

/**
 * Animates `el` through `frames` and resolves once its final frame is applied
 * as inline style. Never rejects.
 */
export function safeAnimate(
  el: HTMLElement | null | undefined,
  frames: StyleFrame[],
  options: KeyframeAnimationOptions = {},
): Promise<void> {
  if (!el || frames.length === 0) return Promise.resolve();
  const last = frames[frames.length - 1];
  if (prefersReducedMotion() || typeof el.animate !== "function") {
    applyFrame(el, last);
    return Promise.resolve();
  }
  const animation = el.animate(frames as Keyframe[], {
    duration: DURATION.panel,
    easing: EASE_OUT,
    fill: "both",
    ...options,
  });
  const settle = () => {
    applyFrame(el, last);
    animation.cancel();
  };
  return animation.finished.then(settle, settle);
}

/** Entrance: rises slightly while fading in. Starts from a visible element. */
export function enter(
  el: HTMLElement | null | undefined,
  delay = 0,
): Promise<void> {
  return safeAnimate(
    el,
    [
      { opacity: 0, transform: "translateY(8px)" },
      { opacity: 1, transform: "none" },
    ],
    { duration: DURATION.enter, delay },
  );
}

/** One soft ring pulse, e.g. for a newly arrived order. */
export function pulse(el: HTMLElement | null | undefined): Promise<void> {
  return safeAnimate(
    el,
    [
      {
        boxShadow:
          "0 0 0 0 color-mix(in oklab, var(--color-primary) 55%, transparent)",
      },
      {
        boxShadow:
          "0 0 0 10px color-mix(in oklab, var(--color-primary) 0%, transparent)",
      },
    ],
    { duration: 900 },
  );
}

/** Quick scale bump, e.g. the cart count after adding an item. */
export function bump(el: HTMLElement | null | undefined): Promise<void> {
  return safeAnimate(
    el,
    [
      { transform: "scale(1)" },
      { transform: "scale(1.35)" },
      { transform: "scale(1)" },
    ],
    { duration: 300 },
  );
}

/**
 * Sends a small dot from `from` to `to` (add-to-cart feedback). Decorative:
 * skipped with reduced motion; the caller's own feedback (badge, toast) remains.
 */
export function flyTo(
  from: Element | null | undefined,
  to: Element | null | undefined,
  color = "var(--color-secondary)",
): Promise<void> {
  if (
    !from ||
    !to ||
    prefersReducedMotion() ||
    typeof document === "undefined"
  ) {
    return Promise.resolve();
  }
  const a = from.getBoundingClientRect();
  const b = to.getBoundingClientRect();
  const dot = document.createElement("div");
  dot.setAttribute("aria-hidden", "true");
  Object.assign(dot.style, {
    position: "fixed",
    zIndex: "1000",
    left: `${a.left + a.width / 2 - 8}px`,
    top: `${a.top + a.height / 2 - 8}px`,
    width: "16px",
    height: "16px",
    borderRadius: "999px",
    background: color,
    boxShadow: "0 0 0 3px var(--color-base-100)",
    pointerEvents: "none",
  });
  document.body.append(dot);
  if (typeof dot.animate !== "function") {
    dot.remove();
    return Promise.resolve();
  }
  const dx = b.left + b.width / 2 - (a.left + a.width / 2);
  const dy = b.top + b.height / 2 - (a.top + a.height / 2);
  const animation = dot.animate(
    [
      { transform: "translate(0, 0) scale(1)", opacity: 1 },
      {
        transform: `translate(${dx * 0.5}px, ${dy - 60}px) scale(1.1)`,
        opacity: 1,
        offset: 0.45,
      },
      { transform: `translate(${dx}px, ${dy}px) scale(0.4)`, opacity: 0.2 },
    ],
    { duration: 600, easing: "cubic-bezier(0.5, 0, 0.2, 1)" },
  );
  return animation.finished.then(
    () => dot.remove(),
    () => dot.remove(),
  );
}

const CONFETTI_COLORS = ["#f9b4da", "#f9e9a9", "#91e2d6", "#007d76", "#63001f"];

/**
 * A short burst of confetti from `anchor` (e.g. "your order is ready").
 * Decorative and self-cleaning; skipped with reduced motion.
 */
export function celebrate(
  anchor: Element | null | undefined,
  pieces = 18,
): void {
  if (!anchor || prefersReducedMotion() || typeof document === "undefined")
    return;
  const box = anchor.getBoundingClientRect();
  const originX = box.left + box.width / 2;
  const originY = box.top + box.height / 2;
  for (let i = 0; i < pieces; i++) {
    const piece = document.createElement("div");
    piece.setAttribute("aria-hidden", "true");
    const size = 6 + (i % 3) * 2;
    Object.assign(piece.style, {
      position: "fixed",
      zIndex: "1000",
      left: `${originX - size / 2}px`,
      top: `${originY - size / 2}px`,
      width: `${size}px`,
      height: `${i % 2 ? size : size * 1.6}px`,
      borderRadius: i % 2 ? "999px" : "2px",
      background: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
      pointerEvents: "none",
    });
    document.body.append(piece);
    if (typeof piece.animate !== "function") {
      piece.remove();
      continue;
    }
    const angle = (Math.PI * 2 * i) / pieces + (i % 2) * 0.3;
    const distance = 70 + (i % 4) * 25;
    const dx = Math.cos(angle) * distance;
    const dy = Math.sin(angle) * distance - 40;
    piece
      .animate(
        [
          { transform: "translate(0, 0) rotate(0deg)", opacity: 1 },
          {
            transform: `translate(${dx}px, ${dy}px) rotate(${180 + i * 20}deg)`,
            opacity: 1,
            offset: 0.6,
          },
          {
            transform: `translate(${dx * 1.1}px, ${dy + 90}px) rotate(${300 + i * 20}deg)`,
            opacity: 0,
          },
        ],
        { duration: 1100, easing: "cubic-bezier(0.22, 1, 0.36, 1)" },
      )
      .finished.then(
        () => piece.remove(),
        () => piece.remove(),
      );
  }
}

/** Duration for Svelte transitions/animations: 0 with reduced motion. */
export function motionMs(ms: number): number {
  return prefersReducedMotion() ? 0 : ms;
}
