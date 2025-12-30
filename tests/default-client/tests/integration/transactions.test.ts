/**
 * Transaction Integration Tests
 *
 * Comprehensive tests for transaction support:
 * - Basic transactions
 * - Rollback on error
 * - Nested operations
 * - Complex workflows
 */

import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import { DB } from 'prisma-flare/generated';
import { cleanDatabase, disconnectPrisma } from '../helpers/database.js';
import { createUser } from '../helpers/factories.js';

describe('Transactions', () => {
  beforeEach(async () => {
    await cleanDatabase();
  });

  afterAll(async () => {
    await disconnectPrisma();
  });

  /**
   * ============================================
   * BASIC TRANSACTIONS
   * ============================================
   */
  describe('Basic Transactions', () => {
    it('should execute queries within transaction', async () => {
      const result = await DB.instance.transaction(async (tx) => {
        const user = await tx.from('user').create({
          email: 'tx@test.com',
          name: 'Transaction User',
        });

        const post = await tx.from('post').create({
          title: 'Transaction Post',
          authorId: user.id,
        });

        return { user, post };
      });

      expect(result.user).toBeDefined();
      expect(result.post).toBeDefined();
      expect(result.post.authorId).toBe(result.user.id);
    });

    it('should persist data after successful transaction', async () => {
      await DB.instance.transaction(async (tx) => {
        await tx.from('user').create({
          email: 'persist@test.com',
          name: 'Persist User',
        });
      });

      const user = await DB.users.where({ email: 'persist@test.com' }).findFirst();
      expect(user).not.toBeNull();
    });

    it('should support multiple operations', async () => {
      await DB.instance.transaction(async (tx) => {
        await tx.from('user').create({ email: 'u1@test.com' });
        await tx.from('user').create({ email: 'u2@test.com' });
        await tx.from('user').create({ email: 'u3@test.com' });
      });

      const count = await DB.users.count();
      expect(count).toBe(3);
    });

    it('should return value from transaction', async () => {
      const userId = await DB.instance.transaction(async (tx) => {
        const user = await tx.from('user').create({
          email: 'return@test.com',
        });
        return user.id;
      });

      expect(typeof userId).toBe('number');

      const user = await DB.users.withId(userId).findUnique();
      expect(user?.email).toBe('return@test.com');
    });
  });

  /**
   * ============================================
   * ROLLBACK ON ERROR
   * ============================================
   */
  describe('Rollback on Error', () => {
    it('should rollback all changes on error', async () => {
      try {
        await DB.instance.transaction(async (tx) => {
          await tx.from('user').create({
            email: 'rollback@test.com',
            name: 'Should Not Exist',
          });

          throw new Error('Force rollback');
        });
      } catch (e) {
        // Expected
      }

      const user = await DB.users.where({ email: 'rollback@test.com' }).findFirst();
      expect(user).toBeNull();
    });

    it('should rollback on Prisma error', async () => {
      const existingUser = await createUser({ email: 'existing@test.com' });

      try {
        await DB.instance.transaction(async (tx) => {
          await tx.from('user').create({
            email: 'new@test.com',
          });

          // This should fail due to unique constraint
          await tx.from('user').create({
            email: 'existing@test.com',
          });
        });
      } catch (e) {
        // Expected
      }

      // New user should not exist due to rollback
      const newUser = await DB.users.where({ email: 'new@test.com' }).findFirst();
      expect(newUser).toBeNull();

      // Only original user exists
      const count = await DB.users.count();
      expect(count).toBe(1);
    });

    it('should rollback multi-step operations', async () => {
      const user = await createUser({ name: 'Original' });

      try {
        await DB.instance.transaction(async (tx) => {
          // Step 1: Update existing user
          await tx.from('user').withId(user.id).update({
            name: 'Changed',
          });

          // Step 2: Create new user
          const newUser = await tx.from('user').create({
            email: 'new@test.com',
          });

          // Step 3: Create post
          await tx.from('post').create({
            title: 'Post',
            authorId: newUser.id,
          });

          // Step 4: Fail
          throw new Error('Multi-step failure');
        });
      } catch (e) {
        // Expected
      }

      // Original user should be unchanged
      const originalUser = await DB.users.withId(user.id).findUnique();
      expect(originalUser?.name).toBe('Original');

      // New user should not exist
      const newUser = await DB.users.where({ email: 'new@test.com' }).findFirst();
      expect(newUser).toBeNull();

      // No posts should exist
      const postCount = await DB.posts.count();
      expect(postCount).toBe(0);
    });
  });

  /**
   * ============================================
   * QUERY BUILDER IN TRANSACTIONS
   * ============================================
   */
  describe('Query Builder in Transactions', () => {
    it('should support where() in transaction', async () => {
      await createUser({ email: 'find@test.com' });

      const result = await DB.instance.transaction(async (tx) => {
        return tx.from('user').where({ email: 'find@test.com' }).findFirst();
      });

      expect(result?.email).toBe('find@test.com');
    });

    it('should support chained queries in transaction', async () => {
      await DB.users.createMany([
        { email: 'a@test.com', name: 'Alice', status: 'active' },
        { email: 'b@test.com', name: 'Bob', status: 'active' },
        { email: 'c@test.com', name: 'Charlie', status: 'pending' },
      ]);

      const result = await DB.instance.transaction(async (tx) => {
        return tx
          .from('user')
          .where({ status: 'active' })
          .order({ name: 'asc' })
          .limit(1)
          .findMany();
      });

      expect(result).toHaveLength(1);
      expect(result[0].name).toBe('Alice');
    });

    it('should support updateMany in transaction', async () => {
      await DB.users.createMany([
        { email: 'a@test.com', status: 'pending' },
        { email: 'b@test.com', status: 'pending' },
      ]);

      await DB.instance.transaction(async (tx) => {
        await tx.from('user').where({ status: 'pending' }).updateMany({
          status: 'processed',
        });
      });

      const processed = await DB.users.where({ status: 'processed' }).count();
      expect(processed).toBe(2);
    });

    it('should support deleteMany in transaction', async () => {
      await DB.users.createMany([
        { email: 'a@test.com', status: 'temp' },
        { email: 'b@test.com', status: 'temp' },
        { email: 'c@test.com', status: 'permanent' },
      ]);

      await DB.instance.transaction(async (tx) => {
        await tx.from('user').where({ status: 'temp' }).deleteMany();
      });

      const count = await DB.users.count();
      expect(count).toBe(1);
    });
  });

  /**
   * ============================================
   * READ-MODIFY-WRITE CYCLES
   * ============================================
   */
  describe('Read-Modify-Write Cycles', () => {
    it('should handle read-modify-write in transaction', async () => {
      const user = await createUser({ name: 'Original' });

      await DB.instance.transaction(async (tx) => {
        // Read
        const current = await tx.from('user').withId(user.id).findUniqueOrThrow();

        // Modify
        const newName = current.name + ' Updated';

        // Write
        await tx.from('user').withId(user.id).update({
          name: newName,
        });
      });

      const updated = await DB.users.withId(user.id).findUnique();
      expect(updated?.name).toBe('Original Updated');
    });

    it('should handle conditional operations', async () => {
      const email = 'conditional@test.com';

      await DB.instance.transaction(async (tx) => {
        const existing = await tx.from('user').where({ email }).findFirst();

        if (!existing) {
          await tx.from('user').create({
            email,
            name: 'Created Conditionally',
          });
        } else {
          await tx.from('user').withId(existing.id).update({
            name: 'Updated Conditionally',
          });
        }
      });

      const user = await DB.users.where({ email }).findFirst();
      expect(user?.name).toBe('Created Conditionally');

      // Run again
      await DB.instance.transaction(async (tx) => {
        const existing = await tx.from('user').where({ email }).findFirst();

        if (!existing) {
          await tx.from('user').create({
            email,
            name: 'Created Conditionally',
          });
        } else {
          await tx.from('user').withId(existing.id).update({
            name: 'Updated Conditionally',
          });
        }
      });

      const updatedUser = await DB.users.where({ email }).findFirst();
      expect(updatedUser?.name).toBe('Updated Conditionally');
    });
  });

  /**
   * ============================================
   * COMPLEX WORKFLOWS
   * ============================================
   */
  describe('Complex Workflows', () => {
    it('should handle user with posts creation', async () => {
      const result = await DB.instance.transaction(async (tx) => {
        const user = await tx.from('user').create({
          email: 'author@test.com',
          name: 'Author',
        });

        const post1 = await tx.from('post').create({
          title: 'First Post',
          authorId: user.id,
        });

        const post2 = await tx.from('post').create({
          title: 'Second Post',
          authorId: user.id,
        });

        return { user, posts: [post1, post2] };
      });

      expect(result.user.id).toBeDefined();
      expect(result.posts).toHaveLength(2);
      expect(result.posts.every((p) => p.authorId === result.user.id)).toBe(true);
    });

    it('should handle batch operations', async () => {
      await DB.instance.transaction(async (tx) => {
        // Batch create users
        await tx.from('user').createMany([
          { email: 'batch1@test.com', name: 'Batch 1' },
          { email: 'batch2@test.com', name: 'Batch 2' },
          { email: 'batch3@test.com', name: 'Batch 3' },
        ]);

        // Batch update
        await tx.from('user').where({ email: { contains: 'batch' } }).updateMany({
          status: 'processed',
        });

        // Partial delete
        await tx.from('user').where({ email: 'batch3@test.com' }).deleteMany();
      });

      const users = await DB.users.where({ email: { contains: 'batch' } }).findMany();
      expect(users).toHaveLength(2);
      expect(users.every((u) => u.status === 'processed')).toBe(true);
    });

    it('should handle transfer-like operation', async () => {
      // Setup: Create two users with "balances" (using views as balance proxy)
      const sender = await createUser({ name: 'Sender' });
      const receiver = await createUser({ name: 'Receiver' });

      const senderPost = await DB.posts.create({
        title: 'Sender Balance',
        authorId: sender.id,
        views: 100,
      });

      const receiverPost = await DB.posts.create({
        title: 'Receiver Balance',
        authorId: receiver.id,
        views: 50,
      });

      const transferAmount = 30;

      // Atomic transfer using IDs for unique constraint
      await DB.instance.transaction(async (tx) => {
        // Deduct from sender
        await tx
          .from('post')
          .withId(senderPost.id)
          .update({ views: { decrement: transferAmount } });

        // Add to receiver
        await tx
          .from('post')
          .withId(receiverPost.id)
          .update({ views: { increment: transferAmount } });
      });

      const senderBalance = await DB.posts.withId(senderPost.id).findFirst();
      const receiverBalance = await DB.posts.withId(receiverPost.id).findFirst();

      expect(senderBalance?.views).toBe(70);
      expect(receiverBalance?.views).toBe(80);
    });

    it('should rollback failed transfer', async () => {
      const sender = await createUser({ name: 'Sender' });
      const receiver = await createUser({ name: 'Receiver' });

      await DB.posts.create({
        title: 'Sender Balance',
        authorId: sender.id,
        views: 100,
      });

      await DB.posts.create({
        title: 'Receiver Balance',
        authorId: receiver.id,
        views: 50,
      });

      try {
        await DB.instance.transaction(async (tx) => {
          // Deduct from sender
          await tx
            .from('post')
            .where({ authorId: sender.id })
            .update({ views: { decrement: 30 } });

          // Simulate failure before credit
          throw new Error('Transfer failed');

          // This never executes
          // await tx.from('post')...
        });
      } catch (e) {
        // Expected
      }

      // Balances should be unchanged
      const senderBalance = await DB.posts
        .where({ authorId: sender.id })
        .findFirst();
      const receiverBalance = await DB.posts
        .where({ authorId: receiver.id })
        .findFirst();

      expect(senderBalance?.views).toBe(100);
      expect(receiverBalance?.views).toBe(50);
    });
  });

  /**
   * ============================================
   * EDGE CASES
   * ============================================
   */
  describe('Edge Cases', () => {
    it('should handle empty transaction', async () => {
      const result = await DB.instance.transaction(async (tx) => {
        return 'empty';
      });

      expect(result).toBe('empty');
    });

    it('should handle transaction returning undefined', async () => {
      const result = await DB.instance.transaction(async (tx) => {
        await tx.from('user').create({ email: 'void@test.com' });
        // No explicit return
      });

      expect(result).toBeUndefined();
    });

    it('should handle transaction with only reads', async () => {
      await createUser({ email: 'readonly@test.com' });

      const result = await DB.instance.transaction(async (tx) => {
        return tx.from('user').findMany();
      });

      expect(result).toHaveLength(1);
    });

    it('should propagate specific error types', async () => {
      class CustomError extends Error {
        constructor(message: string) {
          super(message);
          this.name = 'CustomError';
        }
      }

      try {
        await DB.instance.transaction(async (tx) => {
          throw new CustomError('Custom error message');
        });
      } catch (e) {
        expect(e).toBeInstanceOf(CustomError);
        expect((e as Error).message).toBe('Custom error message');
      }
    });
  });
});
