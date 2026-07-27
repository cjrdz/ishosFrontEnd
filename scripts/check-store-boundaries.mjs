import fs from "node:fs";
import path from "node:path";

const projectRoot = process.cwd();

const sourceRoots = [
  "src/components/svelte/store",
  "src/lib/store",
  "src/pages/api/store",
];

const disallowedRoots = [
  path.resolve(projectRoot, "src/lib/admin"),
  path.resolve(projectRoot, "src/components/svelte/admin"),
  path.resolve(projectRoot, "src/pages/api/admin"),
];

const allowedExtensions = new Set([".ts", ".js", ".svelte", ".astro"]);

function walk(dir) {
  const out = [];
  const entries = fs.readdirSync(dir, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      out.push(...walk(fullPath));
      continue;
    }

    if (allowedExtensions.has(path.extname(entry.name))) {
      out.push(fullPath);
    }
  }

  return out;
}

function toLineNumber(source, idx) {
  return source.slice(0, idx).split("\n").length;
}

function resolveImportPath(fromFile, specifier) {
  if (!specifier || !specifier.startsWith(".")) {
    return null;
  }

  const base = path.resolve(path.dirname(fromFile), specifier);
  return path.normalize(base);
}

function isDisallowedImport(fromFile, specifier) {
  const resolved = resolveImportPath(fromFile, specifier);
  if (!resolved) {
    return false;
  }

  return disallowedRoots.some((root) =>
    resolved === root || resolved.startsWith(root + path.sep),
  );
}

function findViolations(filePath) {
  const source = fs.readFileSync(filePath, "utf8");
  const violations = [];

  const importRegex =
    /import\s+(?:[^"'()]*?\s+from\s+)?["']([^"']+)["']|import\(\s*["']([^"']+)["']\s*\)/g;

  let match;
  while ((match = importRegex.exec(source)) !== null) {
    const specifier = match[1] || match[2];
    if (!specifier) continue;

    if (isDisallowedImport(filePath, specifier)) {
      violations.push({
        filePath,
        line: toLineNumber(source, match.index),
        specifier,
      });
    }
  }

  return violations;
}

let files = [];
for (const root of sourceRoots) {
  const fullRoot = path.resolve(projectRoot, root);
  if (fs.existsSync(fullRoot)) {
    files = files.concat(walk(fullRoot));
  }
}

let violations = [];
for (const filePath of files) {
  violations = violations.concat(findViolations(filePath));
}

if (violations.length > 0) {
  console.error("Store boundary violations found:\n");
  for (const v of violations) {
    console.error(`- ${path.relative(projectRoot, v.filePath)}:${v.line} -> ${v.specifier}`);
  }
  process.exit(1);
}

console.log("Store boundary check passed. No store-to-admin imports found.");
