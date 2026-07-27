interface AddonSelection {
  includedIds: string[];
  extraIds: string[];
}

/**
 * Computes the new addon selection after a chip is tapped in a unified
 * included/extra selector.
 *
 * Rules:
 * - The first `allowance` distinct selections become included (free).
 * - Tapping an included item again adds it as an extra (double portion).
 * - Tapping an item that is both included and extra removes the extra portion.
 * - Tapping an extra-only item removes it.
 * - Tapping an unselected item when free slots remain adds it as included.
 * - Tapping an unselected item when free slots are full adds it as an extra.
 * - Tapping the "none" item clears everything.
 */
export function computeAddonSelection(
  current: AddonSelection,
  clickedId: string,
  noneId: string,
  allowance: number = 1,
): AddonSelection {
  const { includedIds, extraIds } = current;

  if (clickedId === noneId) {
    return { includedIds: [], extraIds: [] };
  }

  const includedSet = new Set(includedIds.filter((id) => id !== noneId));
  const extraSet = new Set(extraIds.filter((id) => id !== noneId));

  if (includedSet.has(clickedId)) {
    if (extraSet.has(clickedId)) {
      // Remove the extra portion, keep the included/free portion.
      extraSet.delete(clickedId);
    } else {
      // Add an extra portion (double).
      extraSet.add(clickedId);
    }
    return {
      includedIds: Array.from(includedSet),
      extraIds: Array.from(extraSet),
    };
  }

  if (extraSet.has(clickedId)) {
    extraSet.delete(clickedId);
    return {
      includedIds: Array.from(includedSet),
      extraIds: Array.from(extraSet),
    };
  }

  // New selection.
  if (includedSet.size < Math.max(0, allowance)) {
    includedSet.add(clickedId);
  } else {
    extraSet.add(clickedId);
  }

  return {
    includedIds: Array.from(includedSet),
    extraIds: Array.from(extraSet),
  };
}

export interface FillSlotResult {
  slots: string[];
  nextActiveIndex: number;
}

/**
 * Fills the active slot with the given flavor and advances the active index to
 * the next empty slot. If all slots are filled, the active index stays put so
 * the user can overwrite the last slot.
 */
export function fillSlot(
  slots: string[],
  flavorId: string,
  activeIndex: number,
): FillSlotResult {
  const safeIndex = Math.max(0, Math.min(activeIndex, slots.length - 1));
  const nextSlots = slots.map((value, index) =>
    index === safeIndex ? flavorId : value,
  );

  const nextEmptyIndex = nextSlots.findIndex((value) => !value);
  const nextActiveIndex = nextEmptyIndex >= 0 ? nextEmptyIndex : safeIndex;

  return { slots: nextSlots, nextActiveIndex };
}
