/**
 * Scoop colour for a flavour name, used by the home "Sabores de la casa" row
 * and the product illustrations. Known flavours get their own tone; others
 * get a stable pick from the brand palette.
 */

const NAMED: Array<[RegExp, string]> = [
  [/leche|crema|queso/, "#fff7e6"],
  [/vainilla/, "#f9e9a9"],
  [/choco|cacao|oreo|brownie/, "#7a4a3a"],
  [/fresa|frambuesa/, "#f9b4da"],
  [/pistacho|menta|hierbabuena/, "#c8e3a0"],
  [/caf[eé]|moka|capuchino/, "#b88a6a"],
  [/mango/, "#ffc857"],
  [/jocote|nance|zapote/, "#e8623c"],
  [/maracuy[aá]|pi[nñ]a|lim[oó]n/, "#f2d06b"],
  [/coco/, "#f6efe0"],
  [/mora|uva|blueberry|ar[aá]ndano/, "#8c4a8a"],
  [/tamarindo|caramelo|dulce de leche|cajeta/, "#c98a4a"],
  [/sand[ií]a|mel[oó]n|guayaba/, "#f48f8f"],
  [/chicle|algod[oó]n|bubble/, "#91e2d6"],
];

const FALLBACK = ["#f9b4da", "#f9e9a9", "#91e2d6", "#ffc857", "#c8e3a0"];

function hash(value: string): number {
  let h = 0;
  for (let i = 0; i < value.length; i++)
    h = (h * 31 + value.charCodeAt(i)) >>> 0;
  return h;
}

export function flavorColor(name: string): string {
  const text = name.toLowerCase();
  for (const [pattern, color] of NAMED) {
    if (pattern.test(text)) return color;
  }
  return FALLBACK[hash(text) % FALLBACK.length];
}
