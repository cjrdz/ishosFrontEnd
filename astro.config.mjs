// @ts-check
import { defineConfig } from 'astro/config';
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
  server: {
    host: true,
  },
  security: {
    checkOrigin: process.env.NODE_ENV === 'production',
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