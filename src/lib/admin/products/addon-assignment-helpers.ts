import type { Addon } from "../../api/admin";

export function splitAddonAssignments(allAddons: Addon[], assignedAddonIds: string[]): {
  available: Addon[];
  assigned: Addon[];
} {
  const assignedSet = new Set(assignedAddonIds);
  const available: Addon[] = [];
  const assigned: Addon[] = [];

  for (const addon of allAddons) {
    if (assignedSet.has(addon.id)) {
      assigned.push(addon);
    } else {
      available.push(addon);
    }
  }

  return { available, assigned };
}

export function filterActiveAddons(addons: Addon[]): Addon[] {
  return addons.filter((addon) => addon.is_active);
}

export function countInactiveAddons(addons: Addon[]): number {
  return addons.filter((addon) => !addon.is_active).length;
}

export function selectedIds(source: Addon[], selected: string[]): string[] {
  const sourceIds = new Set(source.map((item) => item.id));
  return selected.filter((id) => sourceIds.has(id));
}
