// This demonstrates using prisma-flare with the NEW prisma-client provider
// (provider = "prisma-client" instead of "prisma-client-js")
// For custom output, import FlareClient from '.prisma-flare' for proper type inference
import { FlareClient } from '.prisma-flare';

export const db = new FlareClient();
