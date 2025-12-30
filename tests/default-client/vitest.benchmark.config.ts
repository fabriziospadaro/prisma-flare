import { defineConfig } from 'vitest/config';
import * as path from 'path';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['tests/benchmark.test.ts'],
    testTimeout: 300000, // 5 minutes for benchmarks
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
        find: /.*\/Desktop\/src\/db$/,
        replacement: path.resolve(__dirname, 'src/db')
      },
    ]
  },
});
