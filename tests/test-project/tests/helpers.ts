// @ts-ignore
import { DB } from 'prisma-flare/generated';

export async function cleanDatabase(): Promise<void> {
  // Delete in order to respect foreign key constraints
  // @ts-ignore
  await DB.posts.deleteMany({});
  // @ts-ignore
  await DB.users.deleteMany({});
}

export async function disconnectPrisma(): Promise<void> {
  // @ts-ignore
  await DB.instance.$disconnect();
}
