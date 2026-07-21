import { fileURLToPath } from 'node:url';

import { defineConfig } from 'vitest/config';

/**
 * Vitest config. The pure engines under `src/lib` (splits, balances) have no I/O
 * and no Supabase dependency, so they run in a plain Node environment. The `@/`
 * alias mirrors tsconfig `paths` so tests import modules exactly as the app does.
 */
export default defineConfig({
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  test: {
    environment: 'node',
    // Pure unit suites only. The integration RLS suite (tests/integration) needs
    // a live Supabase test project and is wired up in Phase 2; the e2e Playwright
    // spec runs separately.
    include: ['tests/unit/**/*.test.ts'],
    exclude: ['tests/e2e/**', 'tests/integration/**', 'node_modules/**'],
  },
});
