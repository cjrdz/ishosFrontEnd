// Vitest stand-in for the `astro:env/server` virtual module. Tests set values
// with setTestSecret(); getSecret mirrors Astro's runtime lookup.
const secrets = new Map<string, string>();

export function setTestSecret(name: string, value: string | undefined): void {
  if (value === undefined) secrets.delete(name);
  else secrets.set(name, value);
}

export function getSecret(name: string): string | undefined {
  return secrets.get(name);
}
