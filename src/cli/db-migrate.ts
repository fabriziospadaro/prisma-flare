#!/usr/bin/env node
/**
 * Database migration utility
 * Runs Prisma migrations and generates the Prisma Client
 */

import { execSync } from 'child_process';
import * as dotenv from 'dotenv';
import { generateQueries } from './generate-queries';
import { loadConfig } from './config';

// Load configuration
const config = loadConfig();

// Load environment variables
dotenv.config({ path: config.envPath });

/**
 * Run database migrations
 */
function runMigrations(): void {
  const databaseUrl = process.env.DATABASE_URL;

  if (!databaseUrl) {
    console.error('❌ DATABASE_URL environment variable is not set');
    process.exit(1);
  }

  try {
    console.log('🔄 Running Prisma migrations...');
    
    // Run prisma migrate dev
    const args = process.argv.slice(2).join(' ');
    const schemaArg = config.isLibraryDev ? '--schema=tests/prisma/schema.prisma' : '';
    
    // If we are in library dev, we might want to pass the schema, but let's respect user args too
    const command = `npx prisma migrate dev ${schemaArg} ${args}`;
    
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

// Run the script
runMigrations();
