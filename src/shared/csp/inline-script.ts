/**
 * Registers an inline script's SHA-256 with Astro's CSP for the current page
 * and returns the script unchanged, to render with
 * `<script is:inline set:html={...} />`.
 *
 * Astro hashes the scripts it bundles but not `is:inline` ones, which the
 * policy would otherwise block. The hash is computed from the exact string
 * that is rendered, so it can never drift from the script. `Astro.csp` is
 * undefined when CSP is off (e.g. `astro dev`); then this is a no-op.
 */
export async function inlineScript(
  astro: { csp?: { insertScriptHash: (hash: `sha256-${string}`) => void } },
  source: string,
): Promise<string> {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(source),
  );
  let binary = "";
  for (const byte of new Uint8Array(digest)) {
    binary += String.fromCharCode(byte);
  }
  astro.csp?.insertScriptHash(`sha256-${btoa(binary)}`);
  return source;
}
