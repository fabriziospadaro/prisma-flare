#!/usr/bin/env node
/**
 * Database seeding utility
 * Runs the Prisma seed script defined in package.json
 */

import { execSync } from 'child_process';
import * as dotenv from 'dotenv';
import { loadConfig } from './config';

// Load configuration
const config = loadConfig();

// Load environment variables
dotenv.config({ path: config.envPath });

/**
 * Run database seed
 */
function seedDatabase(): void {
  const databaseUrl = process.env.DATABASE_URL;

  if (!databaseUrl) {
    console.error('❌ DATABASE_URL environment variable is not set');
    process.exit(1);
  }

  try {
    console.log('🔄 Seeding database...');

    // Run prisma db seed
    execSync('npx prisma db seed', {
      stdio: 'inherit',
      env: process.env,
    });

    console.log('✓ Database seeded successfully');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error seeding database:', error);
    process.exit(1);
  }
}

// Run the script
seedDatabase();
