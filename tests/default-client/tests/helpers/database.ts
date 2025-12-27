/**
 * Database Test Helpers
 * Utilities for database setup, cleanup, and connection management
 */

import { PrismaClient } from '@prisma/client';

let prisma: PrismaClient | null = null;

/**
 * Get or create a singleton Prisma client for tests
 */
export function getPrismaClient(): PrismaClient {
  if (!prisma) {
    prisma = new PrismaClient({
      log: process.env.DEBUG_PRISMA ? ['query', 'info', 'warn', 'error'] : [],
    });
  }
  return prisma;
}

/**
 * Clean all tables in the database
 * Order matters due to foreign key constraints
 */
export async function cleanDatabase(): Promise<void> {
  const client = getPrismaClient();

  // Delete in order of dependencies (children first)
  await client.post.deleteMany({});
  await client.user.deleteMany({});
}

/**
 * Disconnect Prisma client and clean up
 */
export async function disconnectPrisma(): Promise<void> {
  if (prisma) {
    await prisma.$disconnect();
    prisma = null;
  }
}

/**
 * Reset database to clean state and reconnect
 */
export async function resetDatabase(): Promise<void> {
  await cleanDatabase();
}

/**
 * Execute raw SQL (useful for specific test scenarios)
 */
export async function executeRaw(sql: string): Promise<void> {
  const client = getPrismaClient();
  await client.$executeRawUnsafe(sql);
}

/**
 * Get current record counts for debugging
 */
export async function getRecordCounts(): Promise<{ users: number; posts: number }> {
  const client = getPrismaClient();
  const [users, posts] = await Promise.all([
    client.user.count(),
    client.post.count(),
  ]);
  return { users, posts };
}
