/**
 * Transaction Tests
 *
 * Tests interactive transactions and rollback behavior.
 */

import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import { DB } from 'prisma-flare/generated';
import { cleanDatabase, disconnect, resetCounter, uniqueEmail, getPrismaClient, hookRegistry } from '#test-helpers';

describe('Transactions', () => {
  beforeEach(async () => {
    await cleanDatabase();
    hookRegistry.clearAll();
    resetCounter();
  });

  afterAll(async () => {
    await disconnect();
  });

  describe('interactive transactions', () => {
    it('commits successful transaction', async () => {
      const prisma = getPrismaClient();

      await prisma.$transaction(async (tx) => {
        await tx.user.create({ data: { email: 'tx1@test.com' } });
        await tx.user.create({ data: { email: 'tx2@test.com' } });
      });

      const count = await DB.users.count();
      expect(count).toBe(2);
    });

    it('rolls back on error', async () => {
      const prisma = getPrismaClient();

      try {
        await prisma.$transaction(async (tx) => {
          await tx.user.create({ data: { email: 'rollback@test.com' } });
          throw new Error('Simulated error');
        });
      } catch {
        // Expected
      }

      const count = await DB.users.count();
      expect(count).toBe(0);
    });

    it('rolls back on constraint violation', async () => {
      const prisma = getPrismaClient();

      await DB.users.create({ email: 'existing@test.com' });

      try {
        await prisma.$transaction(async (tx) => {
          await tx.user.create({ data: { email: 'new@test.com' } });
          // This should fail - duplicate email
          await tx.user.create({ data: { email: 'existing@test.com' } });
        });
      } catch {
        // Expected
      }

      // Only the original user should exist
      const count = await DB.users.count();
      expect(count).toBe(1);
    });

    // Note: This test is skipped because SQLite's locking model causes deadlock
    // when reading outside a transaction while inside it. This is expected SQLite
    // behavior, not a prisma-flare issue. Works fine with PostgreSQL/MySQL.
    it.skip('maintains isolation', async () => {
      const prisma = getPrismaClient();

      const user = await DB.users.create({ email: uniqueEmail(), name: 'Original' });

      const txPromise = prisma.$transaction(async (tx) => {
        await tx.user.update({
          where: { id: user.id },
          data: { name: 'Updated in TX' },
        });

        // Read outside transaction should see original
        const outsideRead = await DB.users.withId(user.id).findUnique();
        expect(outsideRead?.name).toBe('Original');

        return tx.user.findUnique({ where: { id: user.id } });
      });

      const txResult = await txPromise;
      expect(txResult?.name).toBe('Updated in TX');
    });
  });

  describe('transaction with multiple models', () => {
    it('creates related records atomically', async () => {
      const prisma = getPrismaClient();

      await prisma.$transaction(async (tx) => {
        const user = await tx.user.create({
          data: { email: 'author@test.com' },
        });

        await tx.post.create({
          data: { title: 'Post 1', authorId: user.id },
        });

        await tx.post.create({
          data: { title: 'Post 2', authorId: user.id },
        });
      });

      const user = await DB.users.include('posts').findFirst();
      expect(user?.posts).toHaveLength(2);
    });

    it('rolls back all models on failure', async () => {
      const prisma = getPrismaClient();

      try {
        await prisma.$transaction(async (tx) => {
          const user = await tx.user.create({
            data: { email: 'fail@test.com' },
          });

          await tx.post.create({
            data: { title: 'Post', authorId: user.id },
          });

          throw new Error('Rollback everything');
        });
      } catch {
        // Expected
      }

      const userCount = await DB.users.count();
      const postCount = await DB.posts.count();

      expect(userCount).toBe(0);
      expect(postCount).toBe(0);
    });
  });

  describe('nested operations in transactions', () => {
    it('handles updates within transaction', async () => {
      const prisma = getPrismaClient();

      const user = await DB.users.create({ email: uniqueEmail(), status: 'pending' });

      await prisma.$transaction(async (tx) => {
        await tx.user.update({
          where: { id: user.id },
          data: { status: 'active' },
        });

        await tx.user.update({
          where: { id: user.id },
          data: { name: 'Updated Name' },
        });
      });

      const updated = await DB.users.withId(user.id).findUnique();
      expect(updated?.status).toBe('active');
      expect(updated?.name).toBe('Updated Name');
    });

    it('handles deletes within transaction', async () => {
      const prisma = getPrismaClient();

      const user1 = await DB.users.create({ email: 'del1@test.com' });
      const user2 = await DB.users.create({ email: 'del2@test.com' });

      await prisma.$transaction(async (tx) => {
        await tx.user.delete({ where: { id: user1.id } });
        await tx.user.delete({ where: { id: user2.id } });
      });

      const count = await DB.users.count();
      expect(count).toBe(0);
    });
  });
});
