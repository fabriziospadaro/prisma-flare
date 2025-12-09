/**
 * Test helper utilities
 */

import { PrismaClient } from '@prisma/client';

let prisma: PrismaClient | null = null;

/**
 * Get Prisma client for tests
 */
export function getPrismaClient(): PrismaClient {
  if (!prisma) {
    prisma = new PrismaClient();
  }
  return prisma;
}

/**
 * Clean database between tests
 */
export async function cleanDatabase(): Promise<void> {
  const client = getPrismaClient();
  
  // Delete in order to respect foreign key constraints
  await client.post.deleteMany({});
  await client.user.deleteMany({});
}

/**
 * Disconnect Prisma client
 */
export async function disconnectPrisma(): Promise<void> {
  if (prisma) {
    await prisma.$disconnect();
    prisma = null;
  }
}
