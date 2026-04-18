import type { APIContext } from "astro";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function validationError(message: string): Response {
  return new Response(
    JSON.stringify({ error: message, code: "VALIDATION_ERROR" }),
    { status: 400, headers: { "Content-Type": "application/json" } },
  );
}

export function requireUuidParam(
  context: APIContext,
  name: string,
): string | Response {
  const value = context.params[name]?.trim() ?? "";
  if (!value || !UUID_RE.test(value)) {
    return validationError(`Invalid ${name} parameter`);
  }
  return value;
}

export function requireAction(
  action: string | null,
  allowed: readonly string[],
): string | Response {
  const value = action?.trim() ?? "";
  if (!value) {
    return validationError("Missing action query parameter");
  }
  if (!allowed.includes(value)) {
    return validationError("Invalid action query parameter");
  }
  return value;
}

export function parseOptionalBoundedInt(
  value: string | null,
  min: number,
  max: number,
): number | Response | null {
  if (!value || value.trim() === "") {
    return null;
  }

  const parsed = Number.parseInt(value, 10);
  if (!Number.isInteger(parsed) || parsed < min || parsed > max) {
    return validationError(
      `Query parameter must be an integer between ${min} and ${max}`,
    );
  }

  return parsed;
}
