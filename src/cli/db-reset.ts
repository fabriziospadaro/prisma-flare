#!/usr/bin/env node
/**
 * Database reset utility
 * Resets the database by dropping and recreating it, then running migrations
 */

import { execSync } from 'child_process';
import * as dotenv from 'dotenv';
import * as readline from 'readline';
import { loadConfig } from './config';

// Load configuration
const config = loadConfig();

// Load environment variables
dotenv.config({ path: config.envPath });

/**
 * Prompt user for confirmation
 */
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

/**
 * Reset database
 */
async function resetDatabase(): Promise<void> {
  const databaseUrl = process.env.DATABASE_URL;
  const skipConfirmation = process.argv.includes('--force') || process.argv.includes('-f');

  if (!databaseUrl) {
    console.error('❌ DATABASE_URL environment variable is not set');
    process.exit(1);
  }

  try {
    // Confirm before resetting
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

    // Use Prisma's built-in reset command
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

// Run the script
resetDatabase();
