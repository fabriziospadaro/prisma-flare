import { describe, it, expect, beforeAll } from 'vitest';
import * as path from 'path';
import { execSync } from 'child_process';
import * as fs from 'fs';

const testProjectDir = path.join(__dirname, 'test-project');
const rootDir = path.resolve(__dirname, '..');

describe('Integration Project Test', () => {
  
  beforeAll(() => {
    // 1. Build the main project
    console.log('Building prisma-flare...');
    execSync('npm run build', { cwd: rootDir, stdio: 'inherit' });

    // Pack the project to simulate real-world usage (only dist files)
    console.log('Packing prisma-flare...');
    execSync('npm pack', { cwd: rootDir, stdio: 'inherit' });
  });

  it('should install dependencies, generate code, and run tests', () => {
    // 2. Install dependencies in test project
    console.log('Installing dependencies in test-project...');
    // We use --no-package-lock to avoid issues with lockfile sync in nested projects sometimes
    execSync('npm install --no-package-lock', { cwd: testProjectDir, stdio: 'inherit' });

    // Install the packed local package
    const files = fs.readdirSync(rootDir);
    const tgzFile = files.find(file => file.startsWith('prisma-flare-') && file.endsWith('.tgz'));
    
    if (!tgzFile) throw new Error('Packed tarball not found');
    const tgzPath = path.join(rootDir, tgzFile);
    
    console.log(`Installing ${tgzPath} in test-project...`);
    execSync(`npm install --no-save ${tgzPath}`, { cwd: testProjectDir, stdio: 'inherit' });

    // Generate Prisma Flare queries
    execSync('npm run generate', { cwd: testProjectDir, stdio: 'inherit' });

    execSync('npm test', { cwd: testProjectDir, stdio: 'inherit' });
  }, 300000); // Increase timeout for install and build (5 mins)
});
