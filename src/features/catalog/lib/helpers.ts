const DEFAULT_ADDON_GROUP_NAME = "extras";

const ADDON_GROUP_LABELS: Record<string, string> = {
  toppings: "Toppings",
  jalea: "Jalea",
  extras: "Extras",
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
