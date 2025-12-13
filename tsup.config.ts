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
  external: ['./generated', '@prisma/client'],
  format: ['cjs', 'esm'],
  dts: true,
  treeshake: false,
  clean: true,
  shims: true,
});
