/**
 * Export wrapper for new-provider to provide DB class compatible with tests.
 * Re-exports FlareClient/FlareBuilder types and creates a DB wrapper.
 */
import { db } from './prisma/db.js';

// Re-export types from flare.ts
export * from './prisma/generated/client/flare.js';

// Create DB wrapper with .users and .posts getters
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
