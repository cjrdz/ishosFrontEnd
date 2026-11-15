(() => {
  const themeWindow = window;
  if (themeWindow.__ishosThemeSyncBound) return;
  themeWindow.__ishosThemeSyncBound = true;

  const resolveTheme = () => {
    // Storage can throw (blocked site data, some private modes).
    let savedTheme = null;
    try {
      savedTheme =
        localStorage.getItem("ishos_theme_store") ??
        localStorage.getItem("theme");
    } catch {
      savedTheme = null;
    }
    const prefersDark = window.matchMedia(
      "(prefers-color-scheme: dark)",
    ).matches;

    return savedTheme === "fantasy" || savedTheme === "night"
      ? savedTheme
      : prefersDark
        ? "night"
        : "fantasy";
  };

  const applyTheme = (targetDocument) => {
    if (!targetDocument?.documentElement) return;
    targetDocument.documentElement.setAttribute("data-theme", resolveTheme());
  };

  // Initial page load
  applyTheme(document);

  // Apply theme to incoming document before it swaps in to avoid flash.
  document.addEventListener("astro:before-swap", (event) => {
    applyTheme(event.newDocument);
  });

  // Re-assert after swap/page load as safety for script/theme toggles.
  document.addEventListener("astro:after-swap", () => {
    applyTheme(document);
  });

  document.addEventListener("astro:page-load", () => {
    applyTheme(document);
  });
})();
