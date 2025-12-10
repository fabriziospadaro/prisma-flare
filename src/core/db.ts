import { loadCallbacks, registerHooks } from './hookMiddleware';
import ExtendedPrismaClient from './extendedPrismaClient';

let db: ExtendedPrismaClient;

if (process.env.NODE_ENV === 'production') {
  db = new ExtendedPrismaClient();
  registerHooks(db);
} else {
  const globalWithDb = global as typeof globalThis & {
    db: ExtendedPrismaClient;
  };

  if (!globalWithDb.db) {
    globalWithDb.db = new ExtendedPrismaClient();
    registerHooks(globalWithDb.db);
  }
  db = globalWithDb.db;
}

export { db, loadCallbacks };
