/**
 * Test adapter for new-provider configuration (Prisma 7 new provider).
 * Exports DB and helpers with consistent interface for shared test suite.
 */
import { db } from './prisma/db.js';
import User from './prisma/models/User.js';
import Post from './prisma/models/Post.js';

// Re-export shared utilities
export { resetCounter, uniqueEmail, assertRecordCreated, assertArrayLength, assertSameRecord } from '../suite/helpers/base.js';

// Export custom model classes for testing
export { User, Post };

// Create a DB wrapper with .users and .posts getters that return FlareBuilders
// This makes the new-provider API compatible with default-client/custom-output
export const DB = {
  get users() {
    return (db as any).from('user');
  },
  get posts() {
    return (db as any).from('post');
  },
  get instance() {
    return db;
  },
};

// Get underlying Prisma client for raw operations
export function getPrismaClient() {
  // For new-provider, the FlareClient is the PrismaClient (it extends it)
  return db as any;
}

export async function cleanDatabase() {
  const prisma = getPrismaClient();
  await prisma.post.deleteMany();
  await prisma.user.deleteMany();
}

export async function disconnect() {
  const prisma = getPrismaClient();
  await prisma.$disconnect();
}

// Bound factories
import { createFactories } from '../suite/helpers/factories.js';
const { createUser, createUserWithPosts } = createFactories(DB as any);
export { createUser, createUserWithPosts };
