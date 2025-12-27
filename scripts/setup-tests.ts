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
 *   all      - all projects (default)
 */

import * as path from 'path';
import { execSync } from 'child_process';
import * as fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

type ProjectType = 'default' | 'custom' | 'new' | 'all';

const PROJECT_CONFIG = {
  default: { folder: 'default-client', needsDbPush: false },
  custom: { folder: 'custom-output', needsDbPush: true },
  new: { folder: 'new-provider', needsDbPush: true },
} as const;

function getProjectType(): ProjectType {
  const arg = process.argv[2];
  if (arg === 'custom') return 'custom';
  if (arg === 'new') return 'new';
  if (arg === 'default') return 'default';
  return 'all';
}

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

function emptyDirectory(dirPath: string) {
  if (fs.existsSync(dirPath)) {
    const files = fs.readdirSync(dirPath);
    for (const file of files) {
      const filePath = path.join(dirPath, file);
      const stat = fs.statSync(filePath);
      if (stat.isDirectory()) {
        fs.rmSync(filePath, { recursive: true });
      } else {
        fs.unlinkSync(filePath);
      }
    }
    console.log(`  Emptied: ${dirPath}`);
  }
}

function setupProject(key: keyof typeof PROJECT_CONFIG) {
  const config = PROJECT_CONFIG[key];
  const testProjectDir = path.join(rootDir, 'tests', config.folder);

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
  const files = fs.readdirSync(rootDir);
  const tgzFile = files.find(file => file.startsWith('prisma-flare-') && file.endsWith('.tgz'));

  if (!tgzFile) {
    console.error('Error: Packed tarball not found. Run npm pack first.');
    process.exit(1);
  }

  const tgzPath = path.join(rootDir, tgzFile);
  console.log(`  Installing ${tgzFile}...`);
  runSilent(`npm install --no-save ${tgzPath}`, testProjectDir);

  // For custom output projects, empty models folder
  if (config.needsDbPush) {
    const modelsPath = path.join(testProjectDir, 'prisma', 'models');
    if (fs.existsSync(modelsPath)) {
      console.log('  Emptying models folder...');
      emptyDirectory(modelsPath);
    }
  }

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
      execSync('npx prisma db push --skip-generate', { cwd: testProjectDir, stdio: 'inherit' });
    } catch (e) {
      console.error('Failed to push database schema');
      throw e;
    }
  }

  console.log(`\n✓ ${config.folder} ready\n`);
}

try {
  const projectType = getProjectType();

  console.log('\n━━━ Building prisma-flare ━━━\n');
  runSilent('npm run build', rootDir);

  console.log('━━━ Packing prisma-flare ━━━\n');
  runSilent('npm pack', rootDir);

  // Note: 'new' provider is excluded from 'all' because Prisma 7 requires adapter configuration
  // which the test suite isn't configured for yet. The prisma-flare integration works (verified
  // by import tests), but full test suite needs Prisma 7 adapter setup.
  const projectsToSetup: (keyof typeof PROJECT_CONFIG)[] =
    projectType === 'all' ? ['default', 'custom'] : [projectType];

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
