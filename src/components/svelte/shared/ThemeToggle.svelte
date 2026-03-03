<script lang="ts">
  import { onMount } from "svelte";

  let theme = $state<"valentine" | "night">("valentine");

  onMount(() => {
    const savedTheme = localStorage.getItem("theme");
    if (savedTheme === "valentine" || savedTheme === "night") {
      theme = savedTheme;
    } else if (window.matchMedia("(prefers-color-scheme: dark)").matches) {
      theme = "night";
    }

    document.documentElement.setAttribute("data-theme", theme);
  });

  function toggleTheme() {
    theme = theme === "valentine" ? "night" : "valentine";
    document.documentElement.setAttribute("data-theme", theme);
    localStorage.setItem("theme", theme);
    window.dispatchEvent(new Event("themechange"));
  }
</script>

<button class="btn btn-ghost btn-circle" type="button" onclick={toggleTheme} aria-label="Cambiar tema">
  {#if theme === "valentine"}
    <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8">
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41" />
    </svg>
  {:else}
    <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6" viewBox="0 0 24 24" fill="currentColor">
      <path d="M20.354 15.354A9 9 0 0 1 8.646 3.646a1 1 0 0 0-1.273-1.273A11 11 0 1 0 21.627 16.627a1 1 0 0 0-1.273-1.273Z"/>
    </svg>
  {/if}
</button>
