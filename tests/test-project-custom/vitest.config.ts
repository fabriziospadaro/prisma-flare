import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    testTimeout: 30000,
    isolate: true,
    maxConcurrency: 1,
    fileParallelism: false
  }
});
