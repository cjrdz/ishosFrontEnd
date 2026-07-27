import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      "@core": fileURLToPath(new URL("./src/core", import.meta.url)),
      "@shared": fileURLToPath(new URL("./src/shared", import.meta.url)),
      "@features": fileURLToPath(new URL("./src/features", import.meta.url)),
    },
  },
  test: {
    globals: true,
    environment: "jsdom",
    include: ["src/**/*.{test,spec}.{ts,js}"],
    coverage: {
      provider: "v8",
      reporter: ["text", "lcov"],
      include: ["src/**/*.{ts,js}"],
      exclude: [
        "src/**/*.test.{ts,js}",
        "src/**/*.spec.{ts,js}",
        "src/pages/**",
        "src/types/**",
        "src/env.d.ts",
      ],
      thresholds: {
        lines: 60,
        functions: 60,
      },
    },
  },
});
