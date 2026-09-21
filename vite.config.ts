// `vitest/config` re-exports Vite's defineConfig with the `test` section added, so the project keeps
// a single config file. Importing it from 'vite' would reject `test` as an unknown property.
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import { execSync } from 'node:child_process';
import { copyFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';

function commitSha(): string {
  if (process.env.GITHUB_SHA) return process.env.GITHUB_SHA;
  try {
    return execSync('git rev-parse HEAD', { stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim();
  } catch {
    return 'unknown';
  }
}

// %VITE_FEEDBACK_ORIGIN% in index.html is only substituted when the variable is defined: default it to empty.
process.env.VITE_FEEDBACK_ORIGIN = process.env.VITE_FEEDBACK_ORIGIN ?? '';

// Base path is configurable so the site can be served from a sub-path (e.g. GitHub Pages /repo/).
const base = process.env.VITE_BASE_PATH ?? '/';

export default defineConfig({
  base,
  plugins: [
    react(),
    {
      // GitHub Pages serves 404.html for unknown paths: copying index.html there makes client-side routing work.
      name: 'spa-404-fallback',
      closeBundle() {
        const dist = resolve(__dirname, 'dist');
        if (existsSync(resolve(dist, 'index.html'))) copyFileSync(resolve(dist, 'index.html'), resolve(dist, '404.html'));
      },
    },
  ],
  define: {
    __COMMIT_SHA__: JSON.stringify(commitSha()),
    __BUILD_TIME__: JSON.stringify(new Date().toISOString()),
  },
  build: {
    sourcemap: true,
    target: 'es2020',
    chunkSizeWarningLimit: 700,
    rollupOptions: {
      output: {
        // Keep the dataset in its own chunk so a data-only update does not invalidate the app code cache (and vice versa).
        manualChunks(id) {
          if (id.includes('/src/generated/dataset.json')) return 'dataset';
          if (id.includes('node_modules')) return 'vendor';
          return undefined;
        },
      },
    },
  },
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
  },
});
