/**
 * Test adapter for default-client configuration.
 * Exports DB and helpers with consistent interface for shared test suite.
 */
import { DB } from 'prisma-flare/generated';
import { PrismaClient } from '@prisma/client';
import User from './prisma/models/User.js';
import Post from './prisma/models/Post.js';

// Re-export shared utilities
export { resetCounter, uniqueEmail, assertRecordCreated, assertArrayLength, assertSameRecord } from '../suite/helpers/base.js';
export { createFactories } from '../suite/helpers/factories.js';

// Export DB for this configuration
export { DB };

// Export custom model classes for testing
export { User, Post };

// Prisma client for raw operations
const prisma = new PrismaClient();

export function getPrismaClient() {
  return prisma;
}

export async function cleanDatabase() {
  await prisma.post.deleteMany();
  await prisma.user.deleteMany();
}

export async function disconnect() {
  await prisma.$disconnect();
}

// Bound factories for convenience
import { createFactories } from '../suite/helpers/factories.js';
const { createUser, createUserWithPosts } = createFactories(DB as any);
export { createUser, createUserWithPosts };
