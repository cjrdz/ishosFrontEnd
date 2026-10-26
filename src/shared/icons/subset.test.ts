import { describe, expect, it } from "vitest";
import path from "node:path";
import { findUsedIcons } from "../../../scripts/icon-usage.mjs";
import iconSubset from "./subset.json";

describe("icon subset", () => {
  it("contains every icon referenced in src (run `pnpm icons:subset` to regenerate)", () => {
    const used = findUsedIcons(path.resolve(__dirname, "../..")) as Record<
      string,
      string[]
    >;
    const available = new Set<string>();
    for (const collection of iconSubset as Array<{
      prefix: string;
      icons: Record<string, unknown>;
      aliases?: Record<string, unknown>;
    }>) {
      for (const name of [
        ...Object.keys(collection.icons),
        ...Object.keys(collection.aliases ?? {}),
      ]) {
        available.add(`${collection.prefix}:${name}`);
      }
    }
    const missing = Object.entries(used).flatMap(([prefix, names]) =>
      names
        .map((name) => `${prefix}:${name}`)
        .filter((icon) => !available.has(icon)),
    );
    expect(missing).toEqual([]);
  });
});
