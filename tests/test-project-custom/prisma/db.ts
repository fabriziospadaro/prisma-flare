// This demonstrates using prisma-flare with a CUSTOM Prisma output path
// The key difference: we import from './generated/client' instead of '@prisma/client'
import { PrismaClient, Prisma } from './generated/client';
import { createFlareClient } from 'prisma-flare';

const FlareClient = createFlareClient(PrismaClient, Prisma);
export const db = new FlareClient();
