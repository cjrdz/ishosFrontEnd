import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

/**
 * Admin screens in both themes. Needs a local admin account:
 *   E2E_ADMIN_EMAIL=... E2E_ADMIN_PASSWORD=... pnpm test:e2e
 */
const email = process.env.E2E_ADMIN_EMAIL;
const password = process.env.E2E_ADMIN_PASSWORD;

test.describe("admin", () => {
  test.skip(!email || !password, "set E2E_ADMIN_EMAIL and E2E_ADMIN_PASSWORD");

  for (const theme of ["fantasy", "night"] as const) {
    test(`board, settings and analytics pass axe · ${theme}`, async ({
      page,
    }) => {
      await page.addInitScript((value) => {
        try {
          localStorage.setItem("ishos_theme_admin", value);
        } catch {
          // ignore
        }
      }, theme);
      await page.goto("/admin/login");
      await page.getByLabel(/correo/i).fill(email!);
      await page
        .getByLabel(/contraseña/i)
        .first()
        .fill(password!);
      await page.getByRole("button", { name: /iniciar sesión/i }).click();
      await page.waitForURL(/\/admin\/?$/);

      for (const path of ["/admin", "/admin/settings", "/admin/analytics"]) {
        await page.goto(path, { waitUntil: "networkidle" });
        const results = await new AxeBuilder({ page })
          .withTags(["wcag2a", "wcag2aa"])
          // ECharts draws on canvas; axe can't read it.
          .exclude("canvas")
          .analyze();
        const summary = results.violations.map(
          (v) =>
            `${path} ${v.id}: ${v.nodes
              .slice(0, 4)
              .map((n) => n.target.join(" "))
              .join(", ")}`,
        );
        expect(summary).toEqual([]);
      }
    });
  }
});
