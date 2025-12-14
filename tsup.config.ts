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
  external: [
    './generated',
    '@prisma/client',
    // Node.js built-in modules must be external to avoid "Dynamic require" errors in ESM
    'fs',
    'path',
    'child_process',
    'url',
    'os',
    'util',
    'stream',
    'events',
    'crypto',
    'buffer',
    'string_decoder',
    'readline',
    'net',
    'tty',
    'assert',
  ],
  format: ['cjs', 'esm'],
  dts: true,
  treeshake: false,
  clean: true,
  shims: true,
});
