#!/usr/bin/env node
/**
 * Database creation utility
 * Creates a new database using the DATABASE_URL from .env
 */

import * as dotenv from 'dotenv';
import { registry } from '../core/adapters';

// Load environment variables
dotenv.config();

/**
 * Create database
 */
async function createDatabase(): Promise<void> {
  const databaseUrl = process.env.DATABASE_URL;

  if (!databaseUrl) {
    console.error('❌ DATABASE_URL environment variable is not set');
    process.exit(1);
  }

  try {
    const adapter = registry.getAdapter(databaseUrl);
    console.log(`✓ Using adapter: ${adapter.name}`);
    
    await adapter.create(databaseUrl);
    process.exit(0);
  } catch (error) {
    console.error('❌ Error creating database:', error);
    process.exit(1);
  }
}

// Run the script
createDatabase();
