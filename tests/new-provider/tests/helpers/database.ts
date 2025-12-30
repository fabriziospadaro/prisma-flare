/**
 * Database Utilities for test-project-prisma-client
 *
 * Provides database connection, cleanup, and lifecycle management
 * for testing with new prisma-client provider configuration.
 */

import { db } from '../../prisma/db.js';

/**
 * Get the FlareClient instance
 */
export function getClient() {
  return db;
}

/**
 * Clean all data from the database
 * Deletes in correct order to respect foreign key constraints
 */
export async function cleanDatabase(): Promise<void> {
  await db.post.deleteMany({});
  await db.user.deleteMany({});
}

/**
 * Disconnect from the database
 */
export async function disconnectDatabase(): Promise<void> {
  await db.$disconnect();
}
