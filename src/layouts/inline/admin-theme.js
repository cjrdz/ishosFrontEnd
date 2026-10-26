(() => {
  const savedTheme =
    localStorage.getItem("ishos_theme_admin") ?? localStorage.getItem("theme");
  const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
  const resolvedTheme =
    savedTheme === "fantasy" || savedTheme === "night"
      ? savedTheme
      : prefersDark
        ? "night"
        : "fantasy";

  document.documentElement.setAttribute("data-theme", resolvedTheme);
})();
