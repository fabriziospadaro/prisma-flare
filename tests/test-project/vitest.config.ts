import { defineConfig } from 'vitest/config';
import * as path from 'path';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['tests/**/*.test.ts'],
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
        // Fix for symlinked library trying to import relative to its physical location
        find: /.*\/Desktop\/src\/db$/,
        replacement: path.resolve(__dirname, 'src/db')
      }
    ]
  },
});
