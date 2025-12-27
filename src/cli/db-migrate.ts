#!/usr/bin/env node

import { execSync } from 'child_process';
import { generateClient } from './generate-client';
import { generateQueries } from './generate-queries';
import { generateCallbacksIndex } from './generate-callbacks';

function runMigrations(): void {
  const databaseUrl = process.env.DATABASE_URL;

  if (!databaseUrl) {
    console.error('❌ DATABASE_URL environment variable is not set');
    process.exit(1);
  }

  try {
    const isDev = process.env.NODE_ENV !== 'production';
    const migrateCommand = isDev ? 'migrate dev' : 'migrate deploy';

    console.log(`🔄 Running Prisma migrations (${isDev ? 'development' : 'production'} mode)...`);

    const args = process.argv.slice(2).join(' ');

    const command = `npx prisma ${migrateCommand} ${args} && npx prisma generate`;

    console.log(`Running: ${command}`);
    execSync(command, {
      stdio: 'inherit',
      env: process.env
    });

    console.log('✓ Migrations completed successfully');

    console.log('🔄 Generating prisma-flare client...');
    generateClient();
    generateQueries();
    generateCallbacksIndex();
    console.log('✓ prisma-flare generation completed successfully');

    process.exit(0);
  } catch (error) {
    console.error('❌ Error running migrations:', error);
    process.exit(1);
  }
}

runMigrations();
