#!/usr/bin/env node
/**
 * Database drop utility
 * Drops the PostgreSQL database specified in DATABASE_URL from .env
 */

import { Client } from 'pg';
import * as dotenv from 'dotenv';
import * as readline from 'readline';

// Load environment variables
dotenv.config();

interface DatabaseConfig {
  host: string;
  port: number;
  user: string;
  password: string;
  database: string;
}

/**
 * Parse PostgreSQL connection string
 */
function parseDatabaseUrl(url: string): DatabaseConfig {
  const regex =
    /postgresql:\/\/([^:]+):([^@]+)@([^:]+):(\d+)\/([^?]+)(\?.*)?/;
  const match = url.match(regex);

  if (!match) {
    throw new Error('Invalid DATABASE_URL format');
  }

  return {
    user: decodeURIComponent(match[1]),
    password: decodeURIComponent(match[2]),
    host: match[3],
    port: parseInt(match[4], 10),
    database: match[5],
  };
}

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
    const config = parseDatabaseUrl(databaseUrl);

    // Confirm before dropping
    if (!skipConfirmation) {
      const confirmed = await confirm(
        `⚠️  Are you sure you want to drop database '${config.database}'? (y/N): `
      );

      if (!confirmed) {
        console.log('❌ Operation cancelled');
        process.exit(0);
      }
    }

    // Connect to postgres database (default)
    const client = new Client({
      host: config.host,
      port: config.port,
      user: config.user,
      password: config.password,
      database: 'postgres',
    });

    await client.connect();
    console.log('✓ Connected to PostgreSQL server');

    // Terminate all connections to the target database
    await client.query(`
      SELECT pg_terminate_backend(pg_stat_activity.pid)
      FROM pg_stat_activity
      WHERE pg_stat_activity.datname = $1
      AND pid <> pg_backend_pid()
    `, [config.database]);

    // Drop database
    await client.query(`DROP DATABASE IF EXISTS "${config.database}"`);
    console.log(`✓ Database '${config.database}' dropped successfully`);

    await client.end();
    process.exit(0);
  } catch (error) {
    console.error('❌ Error dropping database:', error);
    process.exit(1);
  }
}

// Run the script
dropDatabase();
