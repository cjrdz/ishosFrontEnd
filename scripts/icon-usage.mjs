// Shared by build-icon-subset.mjs and the icon subset test: finds every
// "collection:name" icon literal used under src/.
import fs from "node:fs";
import path from "node:path";

export const ICON_COLLECTIONS = ["lucide", "proicons", "line-md"];
const ICON_PATTERN = new RegExp(`\\b(${ICON_COLLECTIONS.join("|")}):([a-z0-9]+(?:-[a-z0-9]+)*)\\b`, "g");
const SOURCE_EXTENSIONS = new Set([".ts", ".js", ".svelte", ".astro"]);
const SUBSET_FILE = path.join("src", "shared", "icons", "subset.json");

function walk(dir, files = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walk(full, files);
    } else if (SOURCE_EXTENSIONS.has(path.extname(entry.name)) && !full.endsWith(SUBSET_FILE)) {
      files.push(full);
    }
  }
  return files;
}

/** Returns a map of collection prefix → sorted unique icon names used in srcDir. */
export function findUsedIcons(srcDir) {
  const used = Object.fromEntries(ICON_COLLECTIONS.map((c) => [c, new Set()]));
  for (const file of walk(srcDir)) {
    const text = fs.readFileSync(file, "utf8");
    for (const match of text.matchAll(ICON_PATTERN)) {
      used[match[1]].add(match[2]);
    }
  }
  return Object.fromEntries(
    Object.entries(used).map(([prefix, names]) => [prefix, [...names].sort()]),
  );
}
