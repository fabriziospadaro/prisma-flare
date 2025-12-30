/**
 * Vitest Configuration for Test Matrix
 *
 * Runs the shared test suite against multiple Prisma configurations.
 * Each project has its own node_modules with configuration-specific generated code.
 */

import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // Run tests in projects
    projects: [
      // Default Client (prisma-client-js, default output)
      './default-client',
      // Custom Output (prisma-client-js, custom output path)
      './custom-output',
      // New Provider is skipped - requires Prisma 7 adapter configuration
    ],
  },
});
