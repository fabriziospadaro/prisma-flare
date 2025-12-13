// @ts-ignore
import { DB } from 'prisma-flare/generated';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
try {
  console.log('Resolved prisma-flare:', require.resolve('prisma-flare'));
} catch (e) {
  console.log('Could not resolve prisma-flare', e);
}

console.log('DB in helpers:', DB);
console.log('DB keys:', Object.keys(DB));
console.log('DB property descriptors:', Object.getOwnPropertyDescriptors(DB));
console.log('DB.posts in helpers:', DB?.posts);

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
