<script lang="ts">
  import { onMount } from "svelte";
  import Icon from "@iconify/svelte";
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
    <Icon icon="lucide:sun" class="h-6 w-6 text-base-content" />
  {:else}
    <Icon icon="lucide:moon" class="h-6 w-6 text-base-content" />
  {/if}
</button>
