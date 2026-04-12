// @ts-check
import { defineConfig } from 'astro/config';
import tailwindcss from '@tailwindcss/vite';

import cloudflare from '@astrojs/cloudflare';
import vercel from '@astrojs/vercel';
import svelte from '@astrojs/svelte';

const deployTarget = process.env.DEPLOY_TARGET;
const isVercelBuild = process.env.VERCEL === '1' || deployTarget === 'vercel';

// https://astro.build/config
export default defineConfig({
  adapter: isVercelBuild ? vercel() : cloudflare(),
  output: 'server',
  integrations: [svelte()],
  vite: {
    plugins: [tailwindcss()],
    optimizeDeps: {
      exclude: ['zod'],
    },
  },
});