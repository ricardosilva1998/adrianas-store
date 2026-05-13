// @ts-check
import { defineConfig } from 'astro/config';

import tailwindcss from '@tailwindcss/vite';
import react from '@astrojs/react';
import node from '@astrojs/node';

// https://astro.build/config
export default defineConfig({
  // Canonical public origin. Used by `Astro.site` for canonical URLs, the
  // sitemap and structured-data absolute URLs. Override via SITE_URL env var
  // for preview environments.
  site: process.env.SITE_URL ?? 'https://drisclub.com',
  output: 'server',
  vite: {
    plugins: [tailwindcss()],
  },
  integrations: [react()],
  adapter: node({
    mode: 'standalone',
  }),
  security: {
    checkOrigin: false,
  },
});
