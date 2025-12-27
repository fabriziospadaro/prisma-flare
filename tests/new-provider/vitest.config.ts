import { defineConfig } from 'vitest/config';
import * as path from 'path';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    testTimeout: 30000,
    isolate: true,
    maxConcurrency: 1,
    fileParallelism: false,
    server: {
      deps: {
        inline: ['prisma-flare', '.prisma-flare'],
      },
    },
  },
  resolve: {
    preserveSymlinks: true,
    alias: [
      {
        // .prisma-flare is a node_modules package, not a relative path
        find: '.prisma-flare',
        replacement: path.resolve(__dirname, 'node_modules/.prisma-flare')
      }
    ]
  },
});
