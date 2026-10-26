// Generates src/shared/icons/subset.json: only the icons the app uses, instead
// of registering the full lucide/proicons collections (~820 KB raw) on every
// page. line-md icons are bundled too, so nothing is fetched from
// api.iconify.design at runtime (which a CSP would block).
//
// Run after adding or renaming an icon:  pnpm icons:subset
// The icon subset test fails in CI when this file is out of date.
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { getIcons } from "@iconify/utils";
import { findUsedIcons } from "./icon-usage.mjs";

const require = createRequire(import.meta.url);
const projectRoot = process.cwd();
const used = findUsedIcons(path.join(projectRoot, "src"));

const collections = [];
const missing = [];
for (const [prefix, names] of Object.entries(used)) {
  if (names.length === 0) continue;
  const full = require(`@iconify-json/${prefix}/icons.json`);
  const subset = getIcons(full, names);
  if (!subset) {
    missing.push(...names.map((n) => `${prefix}:${n}`));
    continue;
  }
  for (const name of names) {
    if (!subset.icons[name] && !subset.aliases?.[name]) missing.push(`${prefix}:${name}`);
  }
  collections.push(subset);
}

if (missing.length > 0) {
  console.error(`Unknown icons (fix the name or install the collection):\n  ${missing.join("\n  ")}`);
  process.exit(1);
}

const outFile = path.join(projectRoot, "src", "shared", "icons", "subset.json");
fs.writeFileSync(outFile, JSON.stringify(collections) + "\n");
const count = collections.reduce((n, c) => n + Object.keys(c.icons).length + Object.keys(c.aliases ?? {}).length, 0);
console.log(`Wrote ${path.relative(projectRoot, outFile)}: ${count} icons, ${fs.statSync(outFile).size} bytes`);
