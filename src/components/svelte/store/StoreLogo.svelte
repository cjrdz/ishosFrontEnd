<script lang="ts">
  import { onMount } from "svelte";

  let theme = $state<"valentine" | "night">("valentine");

  function syncTheme() {
    const current = document.documentElement.getAttribute("data-theme");
    theme = current === "night" ? "night" : "valentine";
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
  {#if theme === "valentine"}
    <img src="/images/blackicon.png" alt="Isho's" width="86" height="86" class="group-hover:scale-110 transition-transform duration-200" />
  {:else}
    <img src="/images/whiteicon.png" alt="Isho's" width="86" height="86" class="group-hover:scale-110 transition-transform duration-200" />
  {/if}
</a>
