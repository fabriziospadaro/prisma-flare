#!/usr/bin/env node

import { execSync } from 'child_process';
import * as dotenv from 'dotenv';
import { generateQueries } from './generate-queries';
import { loadConfig } from './config';

const config = loadConfig();

dotenv.config({ path: config.envPath });

function runMigrations(): void {
  const databaseUrl = process.env.DATABASE_URL;

  if (!databaseUrl) {
    console.error('❌ DATABASE_URL environment variable is not set');
    process.exit(1);
  }

  try {
    console.log('🔄 Running Prisma migrations...');

    const args = process.argv.slice(2).join(' ');

    const command = `npx prisma migrate dev ${args}`;

    console.log(`Running: ${command}`);
    execSync(command, {
      stdio: 'inherit',
      env: process.env
    });

    console.log('✓ Migrations completed successfully');

    console.log('🔄 Generating Query classes...');
    generateQueries();
    console.log('✓ Query classes generated successfully');

    process.exit(0);
  } catch (error) {
    console.error('❌ Error running migrations:', error);
    process.exit(1);
  }
}

runMigrations();
