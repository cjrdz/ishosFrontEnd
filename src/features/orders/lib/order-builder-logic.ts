export interface AddonSelection {
  includedId: string | null;
  extraIds: string[];
}

/**
 * Computes the new addon selection after a chip is tapped in a unified
 * included/extra selector.
 *
 * Rules:
 * - First selection becomes the included (free) item.
 * - Tapping the included item again adds it as an extra (double portion).
 * - Tapping an item that is both included and extra removes the extra portion.
 * - Tapping a different unselected item adds it as an extra.
 * - Tapping an extra item removes it.
 * - Tapping the "none" item clears everything.
 */
export function computeAddonSelection(
  current: AddonSelection,
  clickedId: string,
  noneId: string,
): AddonSelection {
  const { includedId, extraIds } = current;
  const effectiveIncludedId =
    includedId === noneId || !includedId ? null : includedId;

  if (clickedId === noneId) {
    return { includedId: null, extraIds: [] };
  }

  if (clickedId === effectiveIncludedId) {
    if (extraIds.includes(clickedId)) {
      return {
        includedId: clickedId,
        extraIds: extraIds.filter((id) => id !== clickedId),
      };
    }
    return { includedId: clickedId, extraIds: [...extraIds, clickedId] };
  }

  if (extraIds.includes(clickedId)) {
    return {
      includedId: effectiveIncludedId,
      extraIds: extraIds.filter((id) => id !== clickedId),
    };
  }

  if (!effectiveIncludedId) {
    return { includedId: clickedId, extraIds };
  }

  return {
    includedId: effectiveIncludedId,
    extraIds: [...extraIds, clickedId],
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
