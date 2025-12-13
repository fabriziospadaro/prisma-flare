import { ExtendedPrismaClient, registerHooks, loadCallbacks } from 'prisma-flare';

export const db = new ExtendedPrismaClient();
registerHooks(db);

export { loadCallbacks };
