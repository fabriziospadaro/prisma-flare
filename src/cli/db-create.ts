#!/usr/bin/env node

import * as dotenv from 'dotenv';
import { registry } from '../core/adapters';
import { loadConfig } from './config';

const config = loadConfig();

dotenv.config({ path: config.envPath });

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

createDatabase();
