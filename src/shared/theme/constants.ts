export const COLOR_THEME = "fantasy" as const;
export const DARK_THEME = "night" as const;

export const ADMIN_THEME_STORAGE_KEY = "ishos_theme_admin" as const;
export const STORE_THEME_STORAGE_KEY = "ishos_theme_store" as const;

export type ThemeMode = typeof COLOR_THEME | typeof DARK_THEME;
