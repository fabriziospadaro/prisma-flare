import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import { DB } from 'prisma-flare/generated';
import { cleanDatabase, disconnectPrisma } from './helpers.js';

describe('Transaction API Tests', () => {
  beforeEach(async () => {
    await cleanDatabase();
  });

  afterAll(async () => {
    await disconnectPrisma();
  });

  it('should execute queries within a transaction using the query builder', async () => {
    const result = await DB.instance.transaction(async (tx) => {
      const user = await tx.from('user').create({
        email: 'tx-user@example.com',
        name: 'Transaction User',
      });

      const post = await tx.from('post').create({
        title: 'Transaction Post',
        content: 'Content',
        authorId: user.id,
      });

      return { user, post };
    });

    expect(result.user).toBeDefined();
    expect(result.post).toBeDefined();
    expect(result.post.authorId).toBe(result.user.id);

    // Verify persistence
    const savedUser = await DB.users.withId(result.user.id).findFirst();
    expect(savedUser).toBeDefined();
    expect(savedUser?.email).toBe('tx-user@example.com');
  });

  it('should rollback transaction on error', async () => {
    try {
      await DB.instance.transaction(async (tx) => {
        await tx.from('user').create({
          email: 'rollback@example.com',
          name: 'Rollback User',
        });

        throw new Error('Force rollback');
      });
    } catch (e) {
      // Expected error
    }

    const user = await DB.users.where({ email: 'rollback@example.com' }).findFirst();
    expect(user).toBeNull();
  });

  it('should handle read-modify-write cycles within a transaction', async () => {
    // Setup: Create a user
    const originalUser = await DB.users.create({
      email: 'rmw@example.com',
      name: 'Original Name',
    });

    await DB.instance.transaction(async (tx) => {
      // Read
      const user = await tx.from('user').withId(originalUser.id).findUniqueOrThrow();

      // Modify
      const newName = user.name + ' Updated';

      // Write
      await tx.from('user').withId(user.id).update({
        name: newName
      });

      // Create related record
      await tx.from('post').create({
        title: 'New Post',
        authorId: user.id,
        published: true
      });
    });

    // Verify
    const updatedUser = await DB.users.withId(originalUser.id)
      .include("posts").findFirst();
    expect(updatedUser?.name).toBe('Original Name Updated');
    expect(updatedUser?.posts).toHaveLength(1);
    expect(updatedUser?.posts[0].title).toBe('New Post');
  });

  it('should rollback complex multi-step operations', async () => {
    // Setup
    const user = await DB.users.create({
      email: 'complex-rollback@example.com',
      name: 'Safe User',
    });

    try {
      await DB.instance.transaction(async (tx) => {
        // Step 1: Update existing user
        await tx.from('user').withId(user.id).update({
          name: 'Changed Name'
        });

        // Step 2: Create new user
        const newUser = await tx.from('user').create({
          email: 'fail-user@example.com',
          name: 'Fail User'
        });

        // Step 3: Create post for new user
        await tx.from('post').create({
          title: 'Fail Post',
          authorId: newUser.id
        });

        // Step 4: Fail
        throw new Error('Complex failure');
      });
    } catch (e) {
      // Expected
    }

    // Verify User A is unchanged
    const safeUser = await DB.users.withId(user.id).findUnique();
    expect(safeUser?.name).toBe('Safe User');

    // Verify User B does not exist
    const failUser = await DB.users.where({ email: 'fail-user@example.com' }).findFirst();
    expect(failUser).toBeNull();
  });

  it('should handle batch operations within transaction', async () => {
    await DB.instance.transaction(async (tx) => {
      // Create Many
      await tx.from('user').createMany([
        { email: 'batch1@example.com', name: 'Batch 1' },
        { email: 'batch2@example.com', name: 'Batch 2' },
        { email: 'batch3@example.com', name: 'Batch 3' },
      ]);

      // Update Many
      await tx.from('user')
        .where({ email: { contains: 'batch' } })
        .updateMany({ name: 'Processed Batch' });

      // Delete Many (subset)
      await tx.from('user')
        .where({ email: 'batch3@example.com' })
        .deleteMany();
    });

    // Verify
    const users = await DB.users.where({ email: { contains: 'batch' } }).findMany();
    expect(users).toHaveLength(2); // 3 created - 1 deleted
    expect(users[0].name).toBe('Processed Batch');
    expect(users[1].name).toBe('Processed Batch');
  });

  it('should support conditional logic inside transaction', async () => {
    const email = 'conditional@example.com';

    await DB.instance.transaction(async (tx) => {
      const existing = await tx.from('user').where({ email }).findFirst();

      if (!existing) {
        await tx.from('user').create({
          email,
          name: 'Created Conditionally'
        });
      } else {
        await tx.from('user').withId(existing.id).update({
          name: 'Updated Conditionally'
        });
      }
    });

    const user = await DB.users.where({ email }).findFirst();
    expect(user?.name).toBe('Created Conditionally');

    // Run again to trigger update path
    await DB.instance.transaction(async (tx) => {
      const existing = await tx.from('user').where({ email }).findFirst();

      if (!existing) {
        await tx.from('user').create({
          email,
          name: 'Created Conditionally'
        });
      } else {
        await tx.from('user').withId(existing.id).update({
          name: 'Updated Conditionally'
        });
      }
    });

    const updatedUser = await DB.users.where({ email }).findFirst();
    expect(updatedUser?.name).toBe('Updated Conditionally');
  });
});
