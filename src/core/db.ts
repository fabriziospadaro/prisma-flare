import { loadCallbacks, addMiddleware } from './hookMiddleware';
import ExtendedPrismaClient from './extendedPrismaClient';

let db: ExtendedPrismaClient;

if (process.env.NODE_ENV === 'production') {
  db = new ExtendedPrismaClient();
  addMiddleware(db);
} else {
  const globalWithDb = global as typeof globalThis & {
    db: ExtendedPrismaClient;
  };

  if (!globalWithDb.db) {
    globalWithDb.db = new ExtendedPrismaClient();
    addMiddleware(globalWithDb.db);
  }
  db = globalWithDb.db;
}

export { db, loadCallbacks };
