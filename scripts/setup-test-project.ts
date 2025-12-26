import * as path from 'path';
import { execSync } from 'child_process';
import * as fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const rootDir = path.resolve(__dirname, '..');

type ProjectType = 'default' | 'custom' | 'all';

function getProjectType(): ProjectType {
  const arg = process.argv[2];
  if (arg === 'custom') return 'custom';
  if (arg === 'all') return 'all';
  return 'default';
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
    console.log(`Emptied directory: ${dirPath}`);
  }
}

function setupProject(projectName: string, isCustom: boolean) {
  const testProjectDir = path.join(rootDir, 'tests', projectName);

  console.log(`\n=== Setting up ${projectName} ===\n`);

  // Remove existing prisma-flare to ensure fresh install
  const prismaFlarePath = path.join(testProjectDir, 'node_modules', 'prisma-flare');
  if (fs.existsSync(prismaFlarePath)) {
    console.log('Removing existing prisma-flare from node_modules...');
    fs.rmSync(prismaFlarePath, { recursive: true });
  }

  console.log(`Installing dependencies in ${projectName}...`);
  runSilent('npm install --no-package-lock', testProjectDir);

  const files = fs.readdirSync(rootDir);
  const tgzFile = files.find(file => file.startsWith('prisma-flare-') && file.endsWith('.tgz'));

  if (!tgzFile) {
    console.error('Packed tarball not found');
    process.exit(1);
  }
  const tgzPath = path.join(rootDir, tgzFile);

  console.log(`Installing ${tgzFile} in ${projectName}...`);
  runSilent(`npm install --no-save ${tgzPath}`, testProjectDir);

  if (isCustom) {
    const modelsPath = path.join(testProjectDir, 'prisma', 'models');
    console.log('Emptying models folder to ensure fresh generation...');
    emptyDirectory(modelsPath);
  }

  console.log('Generating Prisma Flare queries...');
  try {
    execSync('npm run generate', { cwd: testProjectDir, stdio: 'inherit' });
  } catch (e) {
    console.error('Failed to generate queries');
    throw e;
  }

  if (isCustom) {
    console.log('Pushing database schema...');
    try {
      execSync('npx prisma db push --skip-generate', { cwd: testProjectDir, stdio: 'inherit' });
    } catch (e) {
      console.error('Failed to push database schema');
      throw e;
    }
  }

  console.log(`\n=== ${projectName} setup complete ===\n`);
}

try {
  const projectType = getProjectType();

  console.log('Building prisma-flare...');
  runSilent('npm run build', rootDir);

  console.log('Packing prisma-flare...');
  runSilent('npm pack', rootDir);

  if (projectType === 'default' || projectType === 'all') {
    setupProject('test-project', false);
  }

  if (projectType === 'custom' || projectType === 'all') {
    setupProject('test-project-custom', true);
  }

  console.log('All setups completed successfully!');
} catch (error) {
  console.error('Setup failed');
  process.exit(1);
}
