export function arraysEqualUnordered(a: string[], b: string[]): boolean {
  if (a.length !== b.length) return false;
  const sortedA = [...a].sort();
  const sortedB = [...b].sort();
  return sortedA.every((value, index) => value === sortedB[index]);
}

export function normalizeIdList(values: string[] | undefined): string[] {
  return Array.from(new Set((values ?? []).filter(Boolean))).sort();
}

export function toggleSelection(list: string[], id: string): string[] {
  return list.includes(id)
    ? list.filter((value) => value !== id)
    : [...list, id];
}
