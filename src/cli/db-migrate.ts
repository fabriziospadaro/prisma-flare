#!/usr/bin/env node

import { execSync } from 'child_process';
import { generateQueries } from './generate-queries';

function runMigrations(): void {
  const databaseUrl = process.env.DATABASE_URL;

  if (!databaseUrl) {
    console.error('❌ DATABASE_URL environment variable is not set');
    process.exit(1);
  }

  try {
    console.log('🔄 Running Prisma migrations...');

    const args = process.argv.slice(2).join(' ');

    const command = `npx prisma migrate dev ${args} && npx prisma generate`;

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
