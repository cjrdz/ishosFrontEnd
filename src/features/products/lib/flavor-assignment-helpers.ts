import type { Flavor } from "@features/admin-management";

export function splitFlavorAssignments(
  allFlavors: Flavor[],
  assignedFlavorIds: string[],
): {
  available: Flavor[];
  assigned: Flavor[];
} {
  const assignedSet = new Set(assignedFlavorIds);
  const available: Flavor[] = [];
  const assigned: Flavor[] = [];

  for (const flavor of allFlavors) {
    if (assignedSet.has(flavor.id)) {
      assigned.push(flavor);
    } else {
      available.push(flavor);
    }
  }

  return { available, assigned };
}

export function filterActiveFlavors(flavors: Flavor[]): Flavor[] {
  return flavors.filter((flavor) => flavor.is_active);
}

export function countInactiveFlavors(flavors: Flavor[]): number {
  return flavors.filter((flavor) => !flavor.is_active).length;
}

export function selectedIds(source: Flavor[], selected: string[]): string[] {
  const sourceIds = new Set(source.map((item) => item.id));
  return selected.filter((id) => sourceIds.has(id));
}
