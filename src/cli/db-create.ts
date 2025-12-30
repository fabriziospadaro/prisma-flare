#!/usr/bin/env node

import { config } from 'dotenv';
import { registry } from '../core/adapters';

// Load .env files before accessing DATABASE_URL
// (unlike Prisma CLI commands, our adapter doesn't auto-load .env)
config();

async function createDatabase(): Promise<void> {
  const databaseUrl = process.env.DATABASE_URL;

  if (!databaseUrl) {
    console.error('❌ DATABASE_URL environment variable is not set');
    console.error('   Make sure DATABASE_URL is set in your .env file or environment');
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

createDatabase();
