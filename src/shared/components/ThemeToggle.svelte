<script lang="ts">
  import { flushSync, onMount } from "svelte";
  import Icon from "@shared/components/AppIcon.svelte";
  import {
    ADMIN_THEME_STORAGE_KEY,
    COLOR_THEME,
    DARK_THEME,
    STORE_THEME_STORAGE_KEY,
    type ThemeMode,
  } from "@shared/theme/constants";
  import { prefersReducedMotion } from "@shared/motion/motion";

  const REVEAL_MS = 1100;
  // Slow start and finish so the colour change reads as one smooth sweep.
  const REVEAL_EASE = "cubic-bezier(0.65, 0, 0.35, 1)";
  /** Width of the soft edge, as a share of the circle (matches the CSS mask). */
  const FEATHER = 0.22;

  function getStorageKey(): string {
    if (
      typeof window !== "undefined" &&
      window.location.pathname.startsWith("/admin")
    ) {
      return ADMIN_THEME_STORAGE_KEY;
    }
    return STORE_THEME_STORAGE_KEY;
  }

  // Initialize theme from localStorage or system preference immediately
  function getInitialTheme(): ThemeMode {
    if (
      typeof window !== "undefined" &&
      typeof window.localStorage !== "undefined"
    ) {
      try {
        const savedTheme =
          window.localStorage.getItem(getStorageKey()) ??
          window.localStorage.getItem("theme");
        if (savedTheme === COLOR_THEME || savedTheme === DARK_THEME) {
          return savedTheme;
        }
      } catch {
        // localStorage might be blocked
      }
    }
    if (
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-color-scheme: dark)").matches
    ) {
      return DARK_THEME;
    }
    return COLOR_THEME;
  }

  let theme = $state<ThemeMode>(getInitialTheme());
  let button = $state<HTMLButtonElement | null>(null);
  let switching = false;

  const isDark = $derived(theme === DARK_THEME);

  onMount(() => {
    document.documentElement.setAttribute("data-theme", theme);
    // Another toggle on the page (or another tab) changed the theme.
    const sync = () => {
      const current = document.documentElement.getAttribute("data-theme");
      theme = current === DARK_THEME ? DARK_THEME : COLOR_THEME;
    };
    window.addEventListener("themechange", sync);
    return () => window.removeEventListener("themechange", sync);
  });

  function applyTheme(next: ThemeMode) {
    theme = next;
    document.documentElement.setAttribute("data-theme", next);
    try {
      localStorage.setItem(getStorageKey(), next);
    } catch {
      // Private mode: the theme lasts for this page only.
    }
    window.dispatchEvent(new Event("themechange"));
  }

  async function toggleTheme() {
    if (switching) return;
    const next = theme === COLOR_THEME ? DARK_THEME : COLOR_THEME;
    const root = document.documentElement;

    if (
      typeof document.startViewTransition !== "function" ||
      prefersReducedMotion()
    ) {
      applyTheme(next);
      return;
    }

    // The new theme spreads in a circle from the button to the farthest corner.
    const rect = button?.getBoundingClientRect();
    const x = rect ? rect.left + rect.width / 2 : window.innerWidth / 2;
    const y = rect ? rect.top + rect.height / 2 : 0;
    const radius = Math.hypot(
      Math.max(x, window.innerWidth - x),
      Math.max(y, window.innerHeight - y),
    );

    switching = true;
    root.classList.add("theme-switching");
    try {
      const transition = document.startViewTransition(() => {
        // The snapshot is taken when this returns, so the icon must be updated too.
        flushSync(() => applyTheme(next));
      });
      await transition.ready;
      // global.css keeps the whole page in the "root" snapshot while switching.
      const newView = "::view-transition-new(root)";
      const oldView = "::view-transition-old(root)";
      const timing = {
        duration: REVEAL_MS,
        easing: REVEAL_EASE,
        fill: "both" as const,
      };
      if (CSS.supports("mask-image", "radial-gradient(#000, transparent)")) {
        // A soft-edged disc (the mask) grows from the button until its solid
        // part covers the farthest corner.
        const end = (radius * 2) / (1 - FEATHER) + 4;
        root.animate(
          {
            maskSize: ["0px 0px", `${end}px ${end}px`],
            maskPosition: [
              `${x}px ${y}px`,
              `${x - end / 2}px ${y - end / 2}px`,
            ],
          },
          { ...timing, pseudoElement: newView },
        );
      } else {
        root.animate(
          {
            clipPath: [
              `circle(0px at ${x}px ${y}px)`,
              `circle(${radius}px at ${x}px ${y}px)`,
            ],
          },
          { ...timing, pseudoElement: newView },
        );
      }
      // The old theme dims slightly as it is covered.
      root.animate(
        { filter: ["brightness(1)", "brightness(0.9)"] },
        { ...timing, pseudoElement: oldView },
      );
      await transition.finished;
    } catch {
      // Skipped or interrupted transitions still leave the new theme applied.
      if (root.getAttribute("data-theme") !== next) applyTheme(next);
    } finally {
      root.classList.remove("theme-switching");
      switching = false;
    }
  }
</script>

<button
  bind:this={button}
  class="btn btn-ghost btn-circle theme-toggle"
  type="button"
  onclick={() => void toggleTheme()}
  aria-label={isDark ? "Cambiar a modo claro" : "Cambiar a modo oscuro"}
  title={isDark ? "Modo claro" : "Modo oscuro"}
>
  <span class="theme-icons" class:is-dark={isDark} aria-hidden="true">
    <span class="theme-icon theme-icon-sun">
      <Icon icon="lucide:sun" class="h-6 w-6 text-base-content" />
    </span>
    <span class="theme-icon theme-icon-moon">
      <Icon icon="lucide:moon" class="h-6 w-6 text-base-content" />
    </span>
  </span>
</button>

<style>
  .theme-icons {
    display: grid;
    width: 1.5rem;
    height: 1.5rem;
    transition: transform 120ms ease;
  }

  /* Both icons share one cell; the current one is upright, the other rotated away. */
  .theme-icon {
    grid-area: 1 / 1;
    display: grid;
    place-items: center;
    transition:
      transform 800ms cubic-bezier(0.34, 1.4, 0.64, 1),
      opacity 500ms ease;
  }

  .theme-icon-sun {
    transform: rotate(0deg) scale(1);
    opacity: 1;
  }

  .theme-icon-moon {
    transform: rotate(-90deg) scale(0.4);
    opacity: 0;
  }

  .is-dark .theme-icon-sun {
    transform: rotate(90deg) scale(0.4);
    opacity: 0;
  }

  .is-dark .theme-icon-moon {
    transform: rotate(0deg) scale(1);
    opacity: 1;
  }

  .theme-toggle:active .theme-icons {
    transform: scale(0.88);
  }

  @media (prefers-reduced-motion: reduce) {
    .theme-icon,
    .theme-icons {
      transition: none;
    }
  }
</style>
