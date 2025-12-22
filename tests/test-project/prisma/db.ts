import { FlareClient, registerHooks } from 'prisma-flare';

export const db = await registerHooks(new FlareClient());
