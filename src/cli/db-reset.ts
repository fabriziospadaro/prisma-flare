#!/usr/bin/env node

import { execSync } from 'child_process';
import * as readline from 'readline';
import { generateClient } from './generate-client';
import { generateQueries } from './generate-queries';
import { generateCallbacksIndex } from './generate-callbacks';

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
  const skipConfirmation = process.argv.includes('--force') || process.argv.includes('-f');

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

    console.log('🔄 Generating prisma-flare client...');
    generateClient();
    generateQueries();
    generateCallbacksIndex();
    console.log('✓ prisma-flare generation completed successfully');

    process.exit(0);
  } catch (error) {
    console.error('❌ Error resetting database:', error);
    process.exit(1);
  }
}

resetDatabase();
