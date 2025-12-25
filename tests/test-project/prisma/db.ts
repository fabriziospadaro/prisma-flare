import { PrismaClient, Prisma } from '@prisma/client';
import { createFlareClient } from 'prisma-flare';

const FlareClient = createFlareClient(PrismaClient, Prisma);
export const db = new FlareClient();
