// @ts-check
import { defineConfig, envField } from 'astro/config';
import { fileURLToPath } from 'node:url';
import tailwindcss from '@tailwindcss/vite';

import cloudflare from '@astrojs/cloudflare';
import vercel from '@astrojs/vercel';
import svelte from '@astrojs/svelte';

const deployTarget = process.env.DEPLOY_TARGET;
const isVercelBuild = process.env.VERCEL === '1' || deployTarget === 'vercel';

// https://astro.build/config
export default defineConfig({
  adapter: isVercelBuild
    ? vercel()
    : cloudflare({
        // Images are served directly from R2 CDN URLs — no Cloudflare Images
        // service needed. Using 'compile' avoids activating the IMAGES binding.
        imageService: 'compile',
        // KV binding name from wrangler.jsonc
        sessionKVBindingName: 'ishosfactory-session',
      }),
  output: 'server',
  env: {
    schema: {
      // Shared with the Go backend; proves the BFF's X-Client-IP header is
      // trustworthy so per-customer rate limits work. Read at runtime (Worker
      // secret / process.env), never inlined into the build.
      BFF_SHARED_SECRET: envField.string({
        context: 'server',
        access: 'secret',
        optional: true,
      }),
      // Signs the short-lived admin session cache cookie. Optional: without it
      // every admin request re-validates the session with the backend.
      SESSION_CACHE_SECRET: envField.string({
        context: 'server',
        access: 'secret',
        optional: true,
      }),
    },
  },
  devToolbar: { enabled: false },
  server: {
    host: true,
  },
  security: {
    checkOrigin: process.env.NODE_ENV === 'production',
    // Astro hashes every script/style it renders (production builds only). For
    // SSR pages it sends the policy as a Content-Security-Policy header, which
    // src/middleware.ts extends (frame-ancestors etc.) and relaxes for styles.
    csp: {
      directives: [
        "default-src 'self'",
        // Product images are served from the R2 public bucket.
        "img-src 'self' data: blob: https://*.r2.dev",
        // Fonts are self-hosted (@fontsource), bundled under /_astro.
        "font-src 'self'",
        "connect-src 'self'",
        // Google Maps embed on /about.
        'frame-src https://www.google.com',
        "manifest-src 'self'",
      ],
      styleDirective: {
        resources: ["'self'"],
      },
      scriptDirective: {
        resources: ["'self'"],
      },
    },
  },
  integrations: [svelte()],
  vite: {
    resolve: {
      alias: {
        '@core': fileURLToPath(new URL('./src/core', import.meta.url)),
        '@shared': fileURLToPath(new URL('./src/shared', import.meta.url)),
        '@features': fileURLToPath(new URL('./src/features', import.meta.url)),
      },
    },
    server: {
      allowedHosts: ['.vusercontent.net'],
      cors: true,
    },
    plugins: [tailwindcss()],
    optimizeDeps: {
      // Exclude packages that export raw .svelte files — esbuild has no Svelte
      // loader and will throw "No loader configured for .svelte files".
      exclude: ['zod', '@iconify/svelte', 'svelte-echarts'],
    },
    // Immutable cache for hashed assets, short TTL for HTML
    build: {
      rollupOptions: {
        output: {
          // Keep chunk names stable for better CDN cache hit rates
          chunkFileNames: '_astro/[name].[hash].js',
          assetFileNames: '_astro/[name].[hash][extname]',
        },
      },
    },
  },
});