// This demonstrates using prisma-flare with a CUSTOM Prisma output path
// For custom output, import FlareClient from 'prisma-flare-generated' for proper type inference
import { FlareClient } from 'prisma-flare-generated';

export const db = new FlareClient();
