<script lang="ts">
  import { onMount } from "svelte";
  import { COLOR_THEME, DARK_THEME, type ThemeMode } from "../../../lib/theme/constants";

  // Initialize theme from localStorage or system preference immediately
  function getInitialTheme(): ThemeMode {
    if (typeof window !== "undefined" && typeof window.localStorage !== "undefined") {
      try {
        const savedTheme = window.localStorage.getItem("theme");
        if (savedTheme === COLOR_THEME || savedTheme === DARK_THEME) {
          return savedTheme;
        }
      } catch (e) {
        // localStorage might be blocked
      }
    }
    if (typeof window !== "undefined" && window.matchMedia("(prefers-color-scheme: dark)").matches) {
      return DARK_THEME;
    }
    return COLOR_THEME;
  }

  let theme = $state<ThemeMode>(getInitialTheme());

  onMount(() => {
    // Ensure theme is applied on mount
    document.documentElement.setAttribute("data-theme", theme);
  });

  function toggleTheme() {
    theme = theme === COLOR_THEME ? DARK_THEME : COLOR_THEME;
    document.documentElement.setAttribute("data-theme", theme);
    localStorage.setItem("theme", theme);
    window.dispatchEvent(new Event("themechange"));
  }
</script>

<button class="btn btn-ghost btn-circle" type="button" onclick={toggleTheme} aria-label="Cambiar tema">
  {#if theme === COLOR_THEME}
    <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6 text-base-content" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8">
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41" />
    </svg>
  {:else}
    <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6 text-base-content" viewBox="0 0 24 24" fill="currentColor">
      <path d="M20.354 15.354A9 9 0 0 1 8.646 3.646a1 1 0 0 0-1.273-1.273A11 11 0 1 0 21.627 16.627a1 1 0 0 0-1.273-1.273Z"/>
    </svg>
  {/if}
</button>
