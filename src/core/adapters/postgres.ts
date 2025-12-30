import { DatabaseAdapter } from './index';

interface PostgresConfig {
  host: string;
  port: number;
  user: string;
  password: string;
  database: string;
}

export const PostgresAdapter: DatabaseAdapter = {
  name: 'postgres',

  matches(url: string): boolean {
    return url.startsWith('postgresql://') || url.startsWith('postgres://');
  },

  async create(url: string): Promise<void> {
    const config = parseDatabaseUrl(url);
    const { Client } = await import('pg');

    // Connect to default 'postgres' database to create the new one
    const client = new Client({
      user: config.user,
      password: config.password,
      host: config.host,
      port: config.port,
      database: 'postgres',
    });

    try {
      await client.connect();
      
      // Check if database exists
      const checkRes = await client.query(
        `SELECT 1 FROM pg_database WHERE datname = $1`,
        [config.database]
      );

      if (checkRes.rowCount === 0) {
        await client.query(`CREATE DATABASE "${config.database}"`);
        console.log(`✅ Database "${config.database}" created successfully.`);
      } else {
        console.log(`⚠️  Database "${config.database}" already exists.`);
      }
    } catch (error) {
      console.error('❌ Error creating database:', error);
      throw error;
    } finally {
      await client.end();
    }
  },

  async drop(url: string): Promise<void> {
    const config = parseDatabaseUrl(url);
    const { Client } = await import('pg');

    const client = new Client({
      user: config.user,
      password: config.password,
      host: config.host,
      port: config.port,
      database: 'postgres',
    });

    try {
      await client.connect();
      
      // Terminate existing connections
      await client.query(
        `SELECT pg_terminate_backend(pg_stat_activity.pid)
         FROM pg_stat_activity
         WHERE pg_stat_activity.datname = $1
         AND pid <> pg_backend_pid()`,
        [config.database]
      );

      await client.query(`DROP DATABASE IF EXISTS "${config.database}"`);
      console.log(`✅ Database "${config.database}" dropped successfully.`);
    } catch (error) {
      console.error('❌ Error dropping database:', error);
      throw error;
    } finally {
      await client.end();
    }
  }
};

function parseDatabaseUrl(url: string): PostgresConfig {
  const regex = /postgres(?:ql)?:\/\/([^:]+):([^@]+)@([^:]+):(\d+)\/([^?]+)(\?.*)?/;
  const match = url.match(regex);

  if (!match) {
    throw new Error('Invalid PostgreSQL connection string');
  }

  return {
    user: decodeURIComponent(match[1]),
    password: decodeURIComponent(match[2]),
    host: match[3],
    port: parseInt(match[4], 10),
    database: match[5],
  };
}
