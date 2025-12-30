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
        find: 'prisma-flare/generated',
        replacement: path.resolve(__dirname, 'node_modules/prisma-flare/dist/generated.js'),
      },
      {
        find: /^prisma-flare$/,
        replacement: path.resolve(__dirname, 'node_modules/prisma-flare/dist/index.js'),
      },
    ],
  },
});
