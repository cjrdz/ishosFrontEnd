<script lang="ts">
  import { onMount } from "svelte";
  import {
    COLOR_THEME,
    DARK_THEME,
    type ThemeMode,
  } from "@shared/theme/constants";
  let theme = $state<ThemeMode>(COLOR_THEME);

  function syncTheme() {
    const current = document.documentElement.getAttribute("data-theme");
    theme = (current === DARK_THEME ? DARK_THEME : COLOR_THEME) as ThemeMode;
  }

  onMount(() => {
    syncTheme();

    const observer = new MutationObserver(syncTheme);
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["data-theme"],
    });

    window.addEventListener("themechange", syncTheme);
    document.addEventListener("astro:after-swap", syncTheme as EventListener);

    return () => {
      observer.disconnect();
      window.removeEventListener("themechange", syncTheme);
      document.removeEventListener(
        "astro:after-swap",
        syncTheme as EventListener,
      );
    };
  });
</script>

<a
  href="/"
  class="btn btn-ghost normal-case text-xl font-bold group"
  aria-label="Inicio"
>
  {#if theme === COLOR_THEME}
    <img
      src="/images/blackicon.png"
      alt="Isho's"
      width="86"
      height="86"
      class="group-hover:scale-110 transition-transform duration-200"
    />
  {:else}
    <img
      src="/images/whiteicon.png"
      alt="Isho's"
      width="86"
      height="86"
      class="group-hover:scale-110 transition-transform duration-200"
    />
  {/if}
</a>
