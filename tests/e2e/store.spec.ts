import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

const THEMES = ["fantasy", "night"] as const;
const PAGES = ["/", "/menu", "/about", "/order/cart", "/order/tracking"];

async function useTheme(page: Page, theme: (typeof THEMES)[number]) {
  await page.addInitScript((value) => {
    try {
      localStorage.setItem("ishos_theme_store", value);
    } catch {
      // storage blocked: the page falls back to the system theme
    }
  }, theme);
}

for (const theme of THEMES) {
  test.describe(`store · ${theme}`, () => {
    test.beforeEach(async ({ page }) => useTheme(page, theme));

    for (const path of PAGES) {
      test(`${path} has no accessibility violations`, async ({ page }) => {
        await page.goto(path, { waitUntil: "networkidle" });
        await expect(page.locator("html")).toHaveAttribute("data-theme", theme);
        const results = await new AxeBuilder({ page })
          .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
          .analyze();
        const summary = results.violations.map(
          (v) =>
            `${v.id}: ${v.nodes.map((n) => n.target.join(" ")).join(", ")}`,
        );
        expect(summary).toEqual([]);
      });

      test(`${path} does not scroll sideways`, async ({ page }) => {
        await page.goto(path, { waitUntil: "networkidle" });
        const overflow = await page.evaluate(
          () =>
            document.documentElement.scrollWidth -
            document.documentElement.clientWidth,
        );
        expect(overflow).toBeLessThanOrEqual(0);
      });
    }
  });
}

test("home shows the brand hero and its artwork for the theme", async ({
  page,
}) => {
  await useTheme(page, "night");
  await page.goto("/", { waitUntil: "networkidle" });
  await expect(
    page.getByRole("heading", {
      level: 1,
      name: /sabores que cuentan historias/i,
    }),
  ).toBeVisible();
  const visibleArt = page.locator(".hero__art img:visible");
  await expect(visibleArt).toHaveCount(1);
  await expect(visibleArt).toHaveAttribute("src", /paletero-noche/);
});

test("mobile menu opens, follows the tracking switch and closes with Escape", async ({
  page,
  isMobile,
}) => {
  test.skip(!isMobile, "the menu button only shows on phones");
  const settings = await (await page.request.get("/api/store/settings")).json();
  await page.goto("/menu", { waitUntil: "networkidle" });
  const toggle = page.locator("[data-nav-toggle]");
  await expect(toggle).toHaveAccessibleName(/abrir menú de navegación/i);
  await toggle.click();
  await expect(toggle).toHaveAttribute("aria-expanded", "true");
  const panel = page.locator("#store-nav-panel");
  // "Seguir mi orden" shows only when the admin turned public tracking on.
  const trackingLink = panel.getByRole("link", { name: "Seguir mi orden" });
  if (settings.tracking_enabled) await expect(trackingLink).toBeVisible();
  else await expect(trackingLink).toHaveCount(0);
  await expect(panel.getByRole("link", { name: "Menú" })).toHaveAttribute(
    "aria-current",
    "page",
  );
  await expect(toggle).toHaveAccessibleName(/cerrar menú de navegación/i);
  await page.keyboard.press("Escape");
  await expect(panel).toBeHidden();
  await expect(toggle).toBeFocused();
});
