// Vitest stand-in for the `astro:middleware` virtual module.
export const defineMiddleware = <T>(handler: T): T => handler;
