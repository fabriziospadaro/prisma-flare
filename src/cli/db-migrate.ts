#!/usr/bin/env node
/**
 * Database migration utility
 * Runs Prisma migrations and generates the Prisma Client
 */

import { execSync } from 'child_process';
import * as dotenv from 'dotenv';
import { generateQueries } from './generate-queries';

// Load environment variables
dotenv.config();

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
    execSync('npx prisma migrate dev', { 
      stdio: 'inherit',
      env: process.env 
    });

    console.log('✓ Migrations completed successfully');

    console.log('🔄 Generating Prisma Client...');
    
    // Generate Prisma Client
    execSync('npx prisma generate', { 
      stdio: 'inherit',
      env: process.env 
    });

    console.log('✓ Prisma Client generated successfully');

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
