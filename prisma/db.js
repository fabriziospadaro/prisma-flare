import { loadCallbacks, addMiddleware } from "./hookMiddleware.js";
import ExtendedPrismaClient from "./extendedPrismaClient.js";

/** @type {ExtendedPrismaClient} */
let db = null;

if (process.env.NODE_ENV === 'production') {
  db = new ExtendedPrismaClient();
  addMiddleware(db);
} else {
  if (!global.db) {
    global.db = new ExtendedPrismaClient();
    addMiddleware(global.db);
  }
  db = global.db;
}

export { db, loadCallbacks };