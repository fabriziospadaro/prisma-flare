/**
 * Type Check Script
 *
 * Runs TypeScript type checking across all test projects.
 *
 * Usage:
 *   npx tsx scripts/check-types.ts [project]
 *
 * Projects:
 *   suite    - tests/suite (type tests)
 *   default  - default-client (standard @prisma/client)
 *   custom   - custom-output (custom output path)
 *   new      - new-provider (prisma-client provider)
 *   prisma6  - prisma-6 (Prisma 6.x)
 *   all      - all projects (default)
 */

import { execSync } from 'child_process';
import {
  ROOT_DIR,
  TEST_PROJECTS,
  ALL_PROJECTS,
  getProjectDir,
  parseProjectArg,
  type ProjectKey,
} from './test-config.js';

function checkTypes(key: ProjectKey): boolean {
  const config = TEST_PROJECTS[key];
  const testDir = getProjectDir(key);

  console.log(`\n━━━ Type checking: ${config.folder} ━━━\n`);

  try {
    execSync('npx tsc --noEmit', { cwd: testDir, stdio: 'inherit' });
    console.log(`\n✓ ${config.folder} passed\n`);
    return true;
  } catch {
    console.error(`\n✗ ${config.folder} failed\n`);
    return false;
  }
}

function checkRoot(): boolean {
  console.log(`\n━━━ Type checking: root (tsconfig.test.json) ━━━\n`);

  try {
    execSync('tsc --noEmit -p tsconfig.test.json', { cwd: ROOT_DIR, stdio: 'inherit' });
    console.log(`\n✓ root passed\n`);
    return true;
  } catch {
    console.error(`\n✗ root failed\n`);
    return false;
  }
}

const projectKey = parseProjectArg(ALL_PROJECTS);

const projectsToCheck =
  projectKey === 'all' ? ALL_PROJECTS : [projectKey];

let allPassed = true;

// Check root tsconfig.test.json first when running all
if (projectKey === 'all') {
  if (!checkRoot()) {
    allPassed = false;
  }
}

for (const project of projectsToCheck) {
  if (!checkTypes(project)) {
    allPassed = false;
  }
}

console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
if (allPassed) {
  console.log('✓ All type checks passed!');
} else {
  console.log('✗ Some type checks failed');
  process.exit(1);
}
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
