#!/usr/bin/env node

import { execSync } from 'child_process';
import * as readline from 'readline';

function confirm(question: string): Promise<boolean> {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer.toLowerCase() === 'y' || answer.toLowerCase() === 'yes');
    });
  });
}

async function resetDatabase(): Promise<void> {
  const databaseUrl = process.env.DATABASE_URL;
  const skipConfirmation = process.argv.includes('--force') || process.argv.includes('-f');

  if (!databaseUrl) {
    console.error('❌ DATABASE_URL environment variable is not set');
    process.exit(1);
  }

  try {
    if (!skipConfirmation) {
      const confirmed = await confirm(
        `⚠️  Are you sure you want to reset the database? This will delete all data! (y/N): `
      );

      if (!confirmed) {
        console.log('❌ Operation cancelled');
        process.exit(0);
      }
    }

    console.log('🔄 Resetting database...');

    execSync('npx prisma migrate reset --force', {
      stdio: 'inherit',
      env: process.env,
    });

    console.log('✓ Database reset successfully');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error resetting database:', error);
    process.exit(1);
  }
}

resetDatabase();
