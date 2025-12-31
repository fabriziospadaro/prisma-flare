/**
 * Test Runner Script
 *
 * Runs vitest across test projects in the matrix.
 *
 * Usage:
 *   npx tsx scripts/run-tests.ts [project]
 *
 * Projects:
 *   default  - default-client (standard @prisma/client)
 *   custom   - custom-output (custom output path)
 *   new      - new-provider (prisma-client provider)
 *   prisma6  - prisma-6 (Prisma 6.x)
 *   all      - all projects (default)
 */

import { execSync } from 'child_process';
import {
  TEST_PROJECTS,
  RUNNABLE_PROJECTS,
  getProjectDir,
  parseProjectArg,
  type ProjectKey,
} from './test-config.js';

function runTests(key: ProjectKey): boolean {
  const config = TEST_PROJECTS[key];
  const testDir = getProjectDir(key);

  console.log(`\n━━━ Running tests: ${config.folder} ━━━\n`);

  try {
    execSync('npx vitest run', { cwd: testDir, stdio: 'inherit' });
    console.log(`\n✓ ${config.folder} passed\n`);
    return true;
  } catch {
    console.error(`\n✗ ${config.folder} failed\n`);
    return false;
  }
}

const projectKey = parseProjectArg(RUNNABLE_PROJECTS);

const projectsToRun =
  projectKey === 'all' ? RUNNABLE_PROJECTS : [projectKey];

let allPassed = true;
for (const project of projectsToRun) {
  if (!runTests(project)) {
    allPassed = false;
  }
}

console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
if (allPassed) {
  console.log('✓ All tests passed!');
} else {
  console.log('✗ Some tests failed');
  process.exit(1);
}
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
