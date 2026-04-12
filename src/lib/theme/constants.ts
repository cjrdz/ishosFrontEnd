export const COLOR_THEME = "fantasy" as const;
export const DARK_THEME = "night" as const;

export type ThemeMode = typeof COLOR_THEME | typeof DARK_THEME;
