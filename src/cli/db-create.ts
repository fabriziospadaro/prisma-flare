#!/usr/bin/env node
/**
 * Database creation utility
 * Creates a new PostgreSQL database using the DATABASE_URL from .env
 */

import { Client } from 'pg';
import * as dotenv from 'dotenv';

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
 * Create database
 */
async function createDatabase(): Promise<void> {
  const databaseUrl = process.env.DATABASE_URL;

  if (!databaseUrl) {
    console.error('❌ DATABASE_URL environment variable is not set');
    process.exit(1);
  }

  try {
    const config = parseDatabaseUrl(databaseUrl);
    
    // Connect to postgres database (default) to create the target database
    const client = new Client({
      host: config.host,
      port: config.port,
      user: config.user,
      password: config.password,
      database: 'postgres', // Connect to default postgres database
    });

    await client.connect();
    console.log('✓ Connected to PostgreSQL server');

    // Check if database already exists
    const checkQuery = `SELECT 1 FROM pg_database WHERE datname = $1`;
    const checkResult = await client.query(checkQuery, [config.database]);

    if (checkResult.rows.length > 0) {
      console.log(`⚠️  Database '${config.database}' already exists`);
      await client.end();
      process.exit(0);
    }

    // Create database
    await client.query(`CREATE DATABASE "${config.database}"`);
    console.log(`✓ Database '${config.database}' created successfully`);

    await client.end();
    process.exit(0);
  } catch (error) {
    console.error('❌ Error creating database:', error);
    process.exit(1);
  }
}

// Run the script
createDatabase();
