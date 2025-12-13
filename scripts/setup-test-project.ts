import * as path from 'path';
import { execSync } from 'child_process';
import * as fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const rootDir = path.resolve(__dirname, '..');
const testProjectDir = path.join(rootDir, 'tests', 'test-project');

try {
  console.log('Building prisma-flare...');
  execSync('npm run build', { cwd: rootDir, stdio: 'inherit' });

  console.log('Packing prisma-flare...');
  execSync('npm pack', { cwd: rootDir, stdio: 'inherit' });

  console.log('Installing dependencies in test-project...');
  execSync('npm install --no-package-lock', { cwd: testProjectDir, stdio: 'inherit' });

  const files = fs.readdirSync(rootDir);
  const tgzFile = files.find(file => file.startsWith('prisma-flare-') && file.endsWith('.tgz'));

  if (!tgzFile) {
    console.error('Packed tarball not found');
    process.exit(1);
  }
  const tgzPath = path.join(rootDir, tgzFile);

  console.log(`Installing ${tgzPath} in test-project...`);
  execSync(`npm install --no-save ${tgzPath}`, { cwd: testProjectDir, stdio: 'inherit' });

  console.log('Generating Prisma Flare queries...');
  execSync('npm run generate', { cwd: testProjectDir, stdio: 'inherit' });
} catch (error) {
  console.error('Setup failed:', error);
  process.exit(1);
}
