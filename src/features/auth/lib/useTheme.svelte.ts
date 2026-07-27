import { onMount } from "svelte";
import {
  COLOR_THEME,
  DARK_THEME,
  type ThemeMode,
} from "@shared/theme/constants";

export function useTheme() {
  let theme = $state<ThemeMode>(COLOR_THEME);

  function sync() {
    const current = document.documentElement.getAttribute("data-theme");
    theme = (current === DARK_THEME ? DARK_THEME : COLOR_THEME) as ThemeMode;
  }

  onMount(() => {
    sync();
    window.addEventListener("themechange", sync);
    return () => window.removeEventListener("themechange", sync);
  });

  return {
    get theme() {
      return theme;
    },
  };
}
