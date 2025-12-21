import { ExtendedPrismaClient, registerHooks } from 'prisma-flare';

export const db = await registerHooks(new ExtendedPrismaClient());
