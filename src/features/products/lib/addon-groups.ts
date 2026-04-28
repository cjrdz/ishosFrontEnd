export const DEFAULT_ADDON_GROUP_NAME = "extras";

const ADDON_GROUP_LABELS: Record<string, string> = {
  toppings: "Toppings",
  jalea: "Jalea",
  extras: "Extras",
};

export type AddonGroupItem = {
  name: string;
  group_name: string;
  display_order: number;
};

export function normalizeAddonGroupName(value: string): string {
  const normalized = value.trim().toLowerCase();
  if (!normalized) {
    return DEFAULT_ADDON_GROUP_NAME;
  }

  switch (normalized) {
    case "topping":
    case "toppings":
      return "toppings";
    case "jalea":
    case "jaleas":
      return "jalea";
    case "extra":
    case "extras":
      return "extras";
    default:
      if (normalized.includes("topping")) {
        return "toppings";
      }
      if (normalized.includes("jalea")) {
        return "jalea";
      }
      if (normalized.includes("extra")) {
        return "extras";
      }
      return normalized;
  }
}

export function addonGroupLabel(value: string): string {
  const normalized = normalizeAddonGroupName(value);
  if (ADDON_GROUP_LABELS[normalized]) {
    return ADDON_GROUP_LABELS[normalized];
  }

  return normalized
    .split(/[\s_-]+/)
    .filter(Boolean)
    .map((chunk) => chunk.charAt(0).toUpperCase() + chunk.slice(1))
    .join(" ");
}

export function sortByDisplayOrderAndName<
  T extends { display_order: number; name: string },
>(left: T, right: T): number {
  return (
    left.display_order - right.display_order ||
    left.name.localeCompare(right.name)
  );
}

export function groupAddonsByGroup<T extends AddonGroupItem>(
  source: T[],
): Array<{ key: string; label: string; items: T[] }> {
  const grouped = new Map<string, T[]>();

  for (const addon of source) {
    const key = normalizeAddonGroupName(addon.group_name);
    const current = grouped.get(key) ?? [];
    current.push(addon);
    grouped.set(key, current);
  }

  return Array.from(grouped.entries())
    .sort((left, right) => left[0].localeCompare(right[0]))
    .map(([key, items]) => ({
      key,
      label: addonGroupLabel(key),
      items: items
        .slice()
        .sort((left, right) => sortByDisplayOrderAndName(left, right)),
    }));
}
