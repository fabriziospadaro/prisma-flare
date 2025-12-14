import * as path from 'path';
import { execSync } from 'child_process';
import * as fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const rootDir = path.resolve(__dirname, '..');
const testProjectDir = path.join(rootDir, 'tests', 'test-project');

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

try {
  console.log('Building prisma-flare...');
  runSilent('npm run build', rootDir);

  console.log('Packing prisma-flare...');
  runSilent('npm pack', rootDir);

  console.log('Installing dependencies in test-project...');
  runSilent('npm install --no-package-lock', testProjectDir);

  const files = fs.readdirSync(rootDir);
  const tgzFile = files.find(file => file.startsWith('prisma-flare-') && file.endsWith('.tgz'));

  if (!tgzFile) {
    console.error('Packed tarball not found');
    process.exit(1);
  }
  const tgzPath = path.join(rootDir, tgzFile);

  console.log(`Installing ${tgzPath} in test-project...`);
  runSilent(`npm install --no-save ${tgzPath}`, testProjectDir);

  console.log('Generating Prisma Flare queries...');
  try {
    execSync('npm run generate', { cwd: testProjectDir, stdio: 'inherit' });
  } catch (e) {
    console.error('Failed to generate queries');
    throw e;
  }
} catch (error) {
  console.error('Setup failed');
  process.exit(1);
}
