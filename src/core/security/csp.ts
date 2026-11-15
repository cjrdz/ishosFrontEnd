/**
 * Pure CSP helpers (no Astro virtual-module imports, so they are unit-testable).
 */

/**
 * Appends each directive whose name is not already present to a CSP value.
 */
export function mergeCspDirectives(
  existing: string | null,
  extra: string[],
): string {
  const parts = (existing ?? "")
    .split(";")
    .map((part) => part.trim())
    .filter(Boolean);
  const present = new Set(
    parts.map((part) => part.split(/\s+/)[0].toLowerCase()),
  );
  for (const directive of extra) {
    const name = directive.split(/\s+/)[0].toLowerCase();
    if (!present.has(name)) {
      parts.push(directive);
    }
  }
  return parts.join("; ");
}

const STYLE_DIRECTIVES = new Set([
  "style-src",
  "style-src-elem",
  "style-src-attr",
]);
const HASH_OR_NONCE = /^'(sha256|sha384|sha512|nonce)-/i;

/**
 * Lets inline styles through while leaving script restrictions untouched.
 *
 * Astro hashes the <style> elements it bundles, but SSR `style="..."`
 * attributes and the view-transition <style> rules it generates at render
 * time are never hashed, so a hash-only style policy blocks them. Browsers
 * ignore 'unsafe-inline' whenever a hash is present, so the hashes are
 * removed from the style directives and 'unsafe-inline' is added instead.
 * Inline styles can only affect presentation; scripts stay hash-locked.
 */
export function allowInlineStyles(policy: string): string {
  return policy
    .split(";")
    .map((part) => part.trim())
    .filter(Boolean)
    .map((part) => {
      const [name, ...sources] = part.split(/\s+/);
      if (!STYLE_DIRECTIVES.has(name.toLowerCase())) {
        return part;
      }
      const kept = sources.filter((source) => !HASH_OR_NONCE.test(source));
      if (!kept.includes("'unsafe-inline'")) {
        kept.push("'unsafe-inline'");
      }
      return [name, ...kept].join(" ");
    })
    .join("; ");
}
