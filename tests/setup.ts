/**
 * Test setup file
 * Loads test environment and sets up/tears down test database
 */

import { execSync } from 'child_process';
import * as dotenv from 'dotenv';
import * as path from 'path';
import { beforeAll, afterAll } from 'vitest';

// Load test environment
dotenv.config({ path: path.resolve(process.cwd(), '.env.test') });

// Setup: Create test database and run migrations before all tests
beforeAll(async () => {
  console.log('\n🧪 Setting up test environment...\n');
  
  // Use our CLI utilities with test environment
  execSync('tsx src/cli/db-drop.ts --force', {
    stdio: 'inherit',
    env: process.env,
  });
  
  execSync('tsx src/cli/db-create.ts', {
    stdio: 'inherit',
    env: process.env,
  });
  
  execSync('tsx src/cli/db-migrate.ts', {
    stdio: 'inherit',
    env: process.env,
  });
  
  console.log('\n✓ Test environment ready\n');
}, 60000);

// Teardown: Drop test database after all tests
afterAll(async () => {
  console.log('\n🧹 Cleaning up test environment...\n');
  
  execSync('tsx src/cli/db-drop.ts --force', {
    stdio: 'inherit',
    env: process.env,
  });
  
  console.log('✓ Test environment cleaned up\n');
}, 30000);
