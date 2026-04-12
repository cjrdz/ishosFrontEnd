<script lang="ts">
  import { onMount } from "svelte";
  import { COLOR_THEME, DARK_THEME, type ThemeMode } from "../../../lib/theme/constants";
  let theme = $state<ThemeMode>(COLOR_THEME);

  function syncTheme() {
    const current = document.documentElement.getAttribute("data-theme");
    theme = (current === DARK_THEME ? DARK_THEME : COLOR_THEME) as ThemeMode;
  }

  onMount(() => {
    syncTheme();
    window.addEventListener("themechange", syncTheme);
    return () => {
      window.removeEventListener("themechange", syncTheme);
    };
  });
</script>

<a href="/" class="btn btn-ghost normal-case text-xl font-bold group" aria-label="Inicio">
  {#if theme === COLOR_THEME}
    <img src="/images/blackicon.png" alt="Isho's" width="86" height="86" class="group-hover:scale-110 transition-transform duration-200" />
  {:else}
    <img src="/images/whiteicon.png" alt="Isho's" width="86" height="86" class="group-hover:scale-110 transition-transform duration-200" />
  {/if}
</a>
