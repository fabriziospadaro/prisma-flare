import { defineConfig } from 'vitest/config';
import * as path from 'path';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: [
      // Unit tests (no database required)
      'tests/unit/**/*.test.ts',
      // Integration tests (require database)
      'tests/integration/**/*.test.ts',
      // Legacy tests (for backwards compatibility)
      'tests/*.test.ts',
    ],
    exclude: [
      '**/node_modules/**',
      '**/benchmark.test.ts', // Exclude benchmarks from regular runs
    ],
    testTimeout: 30000,
    // Run tests sequentially for database consistency
    fileParallelism: false,
    maxConcurrency: 1,
    // Coverage configuration
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: [
        'node_modules/',
        'tests/',
        '**/*.d.ts',
      ],
    },
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
      },
      {
        // .prisma-flare is a node_modules package, not a relative path
        find: '.prisma-flare',
        replacement: path.resolve(__dirname, 'node_modules/.prisma-flare')
      }
    ]
  },
});
