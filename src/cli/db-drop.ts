#!/usr/bin/env node
/**
 * Database drop utility
 * Drops the database specified in DATABASE_URL from .env
 */

import * as dotenv from 'dotenv';
import * as readline from 'readline';
import { registry } from '../core/adapters';
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
 * Drop database
 */
async function dropDatabase(): Promise<void> {
  const databaseUrl = process.env.DATABASE_URL;
  const skipConfirmation = process.argv.includes('--force') || process.argv.includes('-f');

  if (!databaseUrl) {
    console.error('❌ DATABASE_URL environment variable is not set');
    process.exit(1);
  }

  try {
    const adapter = registry.getAdapter(databaseUrl);
    console.log(`✓ Using adapter: ${adapter.name}`);

    // Confirm before dropping
    if (!skipConfirmation) {
      const confirmed = await confirm(
        `⚠️  Are you sure you want to drop the database? (y/N): `
      );

      if (!confirmed) {
        console.log('❌ Operation cancelled');
        process.exit(0);
      }
    }

    await adapter.drop(databaseUrl);
    process.exit(0);
  } catch (error) {
    console.error('❌ Error dropping database:', error);
    process.exit(1);
  }
}

// Run the script
dropDatabase();
