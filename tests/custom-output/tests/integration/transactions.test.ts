/**
 * Transactions Integration Tests - Custom Output Path
 *
 * Verifies transactions work correctly with custom output path
 */

import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import { cleanDatabase, disconnectDatabase, getClient } from '../helpers';
import { createUser, resetCounters } from '../helpers';

const db = getClient();

describe('Transactions - Custom Output Path', () => {
  beforeEach(async () => {
    await cleanDatabase();
    resetCounters();
  });

  afterAll(async () => {
    await disconnectDatabase();
  });

  describe('Basic Transactions', () => {
    it('should execute queries within transaction', async () => {
      const result = await db.transaction(async (tx) => {
        const user = await tx.user.create({
          data: { email: 'tx@test.com', name: 'TX User' },
        });

        const post = await tx.post.create({
          data: { title: 'TX Post', authorId: user.id },
        });

        return { user, post };
      });

      expect(result.user.id).toBeDefined();
      expect(result.post.authorId).toBe(result.user.id);
    });

    it('should persist data after successful transaction', async () => {
      await db.transaction(async (tx) => {
        await tx.user.create({
          data: { email: 'persist@test.com', name: 'Persist User' },
        });
      });

      const user = await db.user.findFirst({ where: { email: 'persist@test.com' } });
      expect(user).not.toBeNull();
    });
  });

  describe('Rollback on Error', () => {
    it('should rollback all changes on error', async () => {
      try {
        await db.transaction(async (tx) => {
          await tx.user.create({
            data: { email: 'rollback@test.com', name: 'Rollback User' },
          });

          throw new Error('Force rollback');
        });
      } catch {
        // Expected
      }

      const user = await db.user.findFirst({ where: { email: 'rollback@test.com' } });
      expect(user).toBeNull();
    });

    it('should rollback on constraint violation', async () => {
      await createUser({ email: 'existing@test.com' });

      try {
        await db.transaction(async (tx) => {
          await tx.user.create({ data: { email: 'new@test.com' } });
          // This should fail due to unique constraint
          await tx.user.create({ data: { email: 'existing@test.com' } });
        });
      } catch {
        // Expected
      }

      // New user should not exist due to rollback
      const newUser = await db.user.findFirst({ where: { email: 'new@test.com' } });
      expect(newUser).toBeNull();
    });
  });

  describe('from() in Transactions', () => {
    it('should support from() method within transaction', async () => {
      await db.transaction(async (tx) => {
        const user = await tx.user.create({
          data: { email: 'from@test.com', name: 'From User' },
        });

        await tx.post.create({
          data: { title: 'From Post', authorId: user.id },
        });

        // Use from() in transaction
        const posts = await tx.from('post').where({ authorId: user.id }).findMany();
        expect(posts).toHaveLength(1);
      });
    });

    it('should support chained queries in transaction', async () => {
      await db.user.createMany({
        data: [
          { email: 'a@test.com', name: 'Alice' },
          { email: 'b@test.com', name: 'Bob' },
        ],
      });

      const result = await db.transaction(async (tx) => {
        return tx.from('user').order({ name: 'asc' }).limit(1).findMany();
      });

      expect(result).toHaveLength(1);
      expect(result[0].name).toBe('Alice');
    });
  });

  describe('Complex Workflows', () => {
    it('should handle read-modify-write in transaction', async () => {
      const user = await createUser({ name: 'Original' });

      await db.transaction(async (tx) => {
        const current = await tx.user.findUnique({ where: { id: user.id } });
        const newName = current!.name + ' Updated';
        await tx.user.update({ where: { id: user.id }, data: { name: newName } });
      });

      const updated = await db.user.findUnique({ where: { id: user.id } });
      expect(updated?.name).toBe('Original Updated');
    });
  });
});
