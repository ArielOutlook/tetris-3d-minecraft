import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['tests/**/*.test.ts'],
    environment: 'node',
    // threads: the forks pool breaks when WATCH_REPORT_DEPENDENCIES is inherited from a parent `node --watch`.
    pool: 'threads',
    coverage: {
      provider: 'v8',
      include: ['src/core/**', 'src/input/autorepeat.ts', 'src/storage/**'],
      exclude: ['src/core/types.ts'],
      thresholds: { lines: 90, functions: 90, statements: 90, branches: 85 },
    },
  },
});
