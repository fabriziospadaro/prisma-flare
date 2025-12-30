import { defineConfig } from 'vitest/config';
import * as path from 'path';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['../suite/**/*.test.ts'],
    testTimeout: 30000,
    fileParallelism: false,
    maxConcurrency: 1,
    server: {
      deps: {
        inline: ['prisma-flare'],
      },
    },
  },
  resolve: {
    preserveSymlinks: true,
    alias: [
      {
        find: '#test-helpers',
        replacement: path.resolve(__dirname, 'adapter.ts'),
      },
      {
        // For new-provider, prisma-flare/generated points to our wrapper that exports DB
        find: 'prisma-flare/generated',
        replacement: path.resolve(__dirname, 'generated-exports.ts'),
      },
      {
        find: /^prisma-flare$/,
        replacement: path.resolve(__dirname, 'node_modules/prisma-flare/dist/index.js'),
      },
    ],
  },
});
