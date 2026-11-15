(() => {
  // Storage can throw (blocked site data, some private modes): fall back to
  // the system preference instead of leaving the page unthemed.
  let savedTheme = null;
  try {
    savedTheme =
      localStorage.getItem("ishos_theme_admin") ??
      localStorage.getItem("theme");
  } catch {
    savedTheme = null;
  }
  const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
  const resolvedTheme =
    savedTheme === "fantasy" || savedTheme === "night"
      ? savedTheme
      : prefersDark
        ? "night"
        : "fantasy";

  document.documentElement.setAttribute("data-theme", resolvedTheme);
})();
