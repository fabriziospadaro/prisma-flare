import { defineConfig } from 'tsup';

export default defineConfig({
  entry: [
    'src/index.ts',
    'src/generated.ts',
    'src/cli/index.ts',
    'src/cli/db-create.ts',
    'src/cli/db-drop.ts',
    'src/cli/db-migrate.ts',
    'src/cli/db-reset.ts',
    'src/cli/db-seed.ts',
    'src/core/queryBuilder.ts',
    'src/core/hooks.ts'
  ],
  // Don't bundle dependencies - let Node.js resolve them at runtime
  // This avoids "Dynamic require" errors with CommonJS packages like pg
  noExternal: [],
  external: [
    './generated',
    '@prisma/client',
    'pg',
    'pluralize',
  ],
  format: ['cjs', 'esm'],
  dts: true,
  treeshake: false,
  clean: true,
  // Disable shims to avoid CommonJS require() polyfill in ESM output
  shims: false,
  // Ensure proper Node.js ESM compatibility
  platform: 'node',
  target: 'node18',
  splitting: false,
});
