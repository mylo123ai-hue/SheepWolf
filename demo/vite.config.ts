import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';

const demoRoot = fileURLToPath(new URL('.', import.meta.url));

export default defineConfig({
  root: demoRoot,
  base: './',
  server: { host: '127.0.0.1', port: 4174, strictPort: true },
  preview: { host: '127.0.0.1', port: 4174, strictPort: true },
  build: {
    outDir: '../demo-dist',
    emptyOutDir: true,
    assetsInlineLimit: 1_000_000,
    cssCodeSplit: false,
    modulePreload: { polyfill: false },
    rollupOptions: { output: { inlineDynamicImports: true } },
  },
});
