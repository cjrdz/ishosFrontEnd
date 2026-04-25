export function formatCurrency(value: number): string {
  return new Intl.NumberFormat("es-SV", {
    style: "currency",
    currency: "USD",
  }).format(value || 0);
}

export function toSlug(value: string): string {
  return value
    .toLowerCase()
    .trim()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-");
}

export function toSafeImageUrl(
  value: string | null | undefined,
): string | undefined {
  if (!value) return undefined;
  if (
    value.startsWith("/") ||
    value.startsWith("http://") ||
    value.startsWith("https://")
  ) {
    return value;
  }
  return undefined;
}
