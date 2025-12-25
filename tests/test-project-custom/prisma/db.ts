// This demonstrates using prisma-flare with a CUSTOM Prisma output path
// For custom output, import FlareClient from '.prisma-flare' for proper type inference
import { FlareClient } from '.prisma-flare';

export const db = new FlareClient();
