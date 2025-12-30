// This demonstrates using prisma-flare with the NEW prisma-client provider
// (provider = "prisma-client" instead of "prisma-client-js")
// For new provider, FlareClient is generated alongside the Prisma client
import { PrismaLibSql } from '@prisma/adapter-libsql';
import { FlareClient } from './generated/client/flare.js';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

// Prisma 7 requires a driver adapter
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const dbPath = join(__dirname, 'dev.db');

const adapter = new PrismaLibSql({ url: `file:${dbPath}` });

export const db = new FlareClient({ adapter: adapter as any });
