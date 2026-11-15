/**
 * Browser smoke tests for the store: layout in both themes, mobile
 * navigation and an axe-core accessibility pass (contrast included).
 *
 * Runs against a running app (default the dev server with a local backend):
 *   pnpm dev            # in another terminal, backend on :8080
 *   pnpm test:e2e
 * Point it elsewhere with E2E_BASE_URL. Not part of CI yet: it needs the
 * backend and its seeded catalog.
 */
import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "tests/e2e",
  timeout: 30_000,
  retries: 0,
  reporter: [["list"]],
  use: {
    baseURL: process.env.E2E_BASE_URL ?? "http://localhost:4321",
    trace: "retain-on-failure",
  },
  projects: [
    { name: "desktop", use: { ...devices["Desktop Chrome"] } },
    { name: "phone", use: { ...devices["Pixel 7"] } },
  ],
});
