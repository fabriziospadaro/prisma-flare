/**
 * Test Projects Setup Script
 *
 * Sets up test projects with fresh prisma-flare installation.
 *
 * Usage:
 *   npx tsx scripts/setup-tests.ts [project]
 *
 * Projects:
 *   default  - default-client (standard @prisma/client)
 *   custom   - custom-output (custom output path)
 *   new      - new-provider (prisma-client provider)
 *   prisma6  - prisma-6 (Prisma 6.x)
 *   all      - all projects (default)
 */

import { execSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import {
  ROOT_DIR,
  TEST_PROJECTS,
  SETUP_PROJECTS,
  getProjectDir,
  parseProjectArg,
  type ProjectKey,
} from './test-config.js';

function runSilent(command: string, cwd: string) {
  try {
    execSync(command, { cwd, stdio: 'pipe' });
  } catch (error: any) {
    console.error(`Command failed: ${command}`);
    if (error.stdout) console.error(error.stdout.toString());
    if (error.stderr) console.error(error.stderr.toString());
    throw error;
  }
}

function setupProject(key: ProjectKey) {
  const config = TEST_PROJECTS[key];
  const testProjectDir = getProjectDir(key);

  console.log(`\n━━━ Setting up ${config.folder} ━━━\n`);

  // Remove existing prisma-flare
  const prismaFlarePath = path.join(testProjectDir, 'node_modules', 'prisma-flare');
  if (fs.existsSync(prismaFlarePath)) {
    console.log('  Removing existing prisma-flare...');
    fs.rmSync(prismaFlarePath, { recursive: true });
  }

  console.log('  Installing dependencies...');
  runSilent('npm install --no-package-lock', testProjectDir);

  // Find and install packed tarball
  const files = fs.readdirSync(ROOT_DIR);
  const tgzFile = files.find(file => file.startsWith('prisma-flare-') && file.endsWith('.tgz'));

  if (!tgzFile) {
    console.error('Error: Packed tarball not found. Run npm pack first.');
    process.exit(1);
  }

  const tgzPath = path.join(ROOT_DIR, tgzFile);
  console.log(`  Installing ${tgzFile}...`);
  runSilent(`npm install --no-save ${tgzPath}`, testProjectDir);

  console.log('  Generating Prisma Flare...');
  try {
    execSync('npm run generate', { cwd: testProjectDir, stdio: 'inherit' });
  } catch (e) {
    console.error('Failed to generate');
    throw e;
  }

  if (config.needsDbPush) {
    console.log('  Pushing database schema...');
    try {
      execSync('npx prisma db push', { cwd: testProjectDir, stdio: 'inherit' });
    } catch (e) {
      console.error('Failed to push database schema');
      throw e;
    }
  }

  console.log(`\n✓ ${config.folder} ready\n`);
}

try {
  const projectKey = parseProjectArg(SETUP_PROJECTS);

  console.log('\n━━━ Building prisma-flare ━━━\n');
  runSilent('npm run build', ROOT_DIR);

  console.log('━━━ Packing prisma-flare ━━━\n');
  runSilent('npm pack', ROOT_DIR);

  const projectsToSetup =
    projectKey === 'all' ? SETUP_PROJECTS : [projectKey];

  for (const project of projectsToSetup) {
    setupProject(project);
  }

  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('✓ All setups completed!');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
} catch (error) {
  console.error('\n✗ Setup failed\n');
  process.exit(1);
}
