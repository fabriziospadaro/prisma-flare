/**
 * Update Operations Integration Tests
 *
 * Comprehensive tests for all update operations:
 * - update()
 * - updateMany()
 */

import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import { DB } from 'prisma-flare/generated';
import { cleanDatabase, disconnectPrisma } from '../../helpers/database.js';
import { createUser, createUsers, createUserWithPosts } from '../../helpers/factories.js';

describe('Update Operations', () => {
  beforeEach(async () => {
    await cleanDatabase();
  });

  afterAll(async () => {
    await disconnectPrisma();
  });

  /**
   * ============================================
   * SINGLE UPDATE
   * ============================================
   */
  describe('update()', () => {
    describe('Basic Updates', () => {
      it('should update a single field', async () => {
        const user = await createUser({ name: 'Original' });

        const updated = await DB.users.withId(user.id).update({
          name: 'Updated',
        });

        expect(updated.name).toBe('Updated');
        expect(updated.id).toBe(user.id);
      });

      it('should update multiple fields', async () => {
        const user = await createUser({
          name: 'Original',
          status: 'pending',
        });

        const updated = await DB.users.withId(user.id).update({
          name: 'Updated',
          status: 'active',
        });

        expect(updated.name).toBe('Updated');
        expect(updated.status).toBe('active');
      });

      it('should auto-update updatedAt', async () => {
        const user = await createUser();
        const originalUpdatedAt = user.updatedAt;

        // Small delay to ensure timestamp difference
        await new Promise((resolve) => setTimeout(resolve, 10));

        const updated = await DB.users.withId(user.id).update({
          name: 'New Name',
        });

        expect(new Date(updated.updatedAt).getTime()).toBeGreaterThan(
          new Date(originalUpdatedAt).getTime()
        );
      });

      it('should not change other fields', async () => {
        const user = await createUser({
          email: 'original@test.com',
          name: 'Original Name',
          status: 'pending',
        });

        const updated = await DB.users.withId(user.id).update({
          status: 'active',
        });

        expect(updated.email).toBe('original@test.com');
        expect(updated.name).toBe('Original Name');
      });

      it('should return complete updated record', async () => {
        const user = await createUser();

        const updated = await DB.users.withId(user.id).update({
          name: 'Updated',
        });

        expect(updated).toHaveProperty('id');
        expect(updated).toHaveProperty('email');
        expect(updated).toHaveProperty('name');
        expect(updated).toHaveProperty('status');
        expect(updated).toHaveProperty('createdAt');
        expect(updated).toHaveProperty('updatedAt');
      });
    });

    describe('Update with Where', () => {
      it('should update using where condition', async () => {
        const user = await createUser({ email: 'target@test.com' });

        const updated = await DB.users
          .where({ email: 'target@test.com' })
          .update({ name: 'Found and Updated' });

        expect(updated.name).toBe('Found and Updated');
        expect(updated.id).toBe(user.id);
      });

      it('should update using unique email constraint', async () => {
        const user = await createUser({
          email: 'unique-update@test.com',
          name: 'Active User',
          status: 'active'
        });
        await createUser({ name: 'Active User', status: 'pending' });

        // Update using unique email field
        const updated = await DB.users
          .where({ email: 'unique-update@test.com' })
          .update({ name: 'Updated Active' });

        expect(updated.id).toBe(user.id);
        expect(updated.name).toBe('Updated Active');
      });
    });

    describe('Data Types', () => {
      it('should update to null', async () => {
        const user = await createUser({ name: 'Has Name' });

        const updated = await DB.users.withId(user.id).update({
          name: null,
        });

        expect(updated.name).toBeNull();
      });

      it('should update to empty string', async () => {
        const user = await createUser({ name: 'Has Name' });

        const updated = await DB.users.withId(user.id).update({
          name: '',
        });

        expect(updated.name).toBe('');
      });

      it('should handle special characters', async () => {
        const user = await createUser();

        const updated = await DB.users.withId(user.id).update({
          name: "O'Brien & Sons <test>",
        });

        expect(updated.name).toBe("O'Brien & Sons <test>");
      });

      it('should handle unicode', async () => {
        const user = await createUser();

        const updated = await DB.users.withId(user.id).update({
          name: '日本語 🎉',
        });

        expect(updated.name).toBe('日本語 🎉');
      });
    });

    describe('Numeric Updates', () => {
      it('should increment numeric field', async () => {
        const { user, posts } = await createUserWithPosts();

        const updated = await DB.posts.withId(posts[0].id).update({
          views: { increment: 1 },
        });

        expect(updated.views).toBe(1);
      });

      it('should decrement numeric field', async () => {
        const { posts } = await createUserWithPosts();

        // First set views to 10
        await DB.posts.withId(posts[0].id).update({ views: 10 });

        const updated = await DB.posts.withId(posts[0].id).update({
          views: { decrement: 3 },
        });

        expect(updated.views).toBe(7);
      });

      it('should multiply numeric field', async () => {
        const { posts } = await createUserWithPosts();

        // First set views to 5
        await DB.posts.withId(posts[0].id).update({ views: 5 });

        const updated = await DB.posts.withId(posts[0].id).update({
          views: { multiply: 3 },
        });

        expect(updated.views).toBe(15);
      });
    });

    describe('Error Handling', () => {
      it('should throw error for non-existent record', async () => {
        await expect(
          DB.users.withId(99999).update({ name: 'Will Fail' })
        ).rejects.toThrow();
      });

      it('should throw error for duplicate unique field', async () => {
        await createUser({ email: 'existing@test.com' });
        const user = await createUser({ email: 'other@test.com' });

        await expect(
          DB.users.withId(user.id).update({ email: 'existing@test.com' })
        ).rejects.toThrow();
      });

      it('should throw error for invalid relation', async () => {
        const { user } = await createUserWithPosts();
        const post = await DB.posts
          .where({ authorId: user.id })
          .findFirst();

        await expect(
          DB.posts.withId(post!.id).update({ authorId: 99999 })
        ).rejects.toThrow();
      });
    });
  });

  /**
   * ============================================
   * BATCH UPDATE
   * ============================================
   */
  describe('updateMany()', () => {
    describe('Basic Batch Updates', () => {
      it('should update all matching records', async () => {
        await createUsers(5);

        const result = await DB.users.updateMany({
          status: 'active',
        });

        expect(result.count).toBe(5);

        const users = await DB.users.findMany();
        expect(users.every((u) => u.status === 'active')).toBe(true);
      });

      it('should update records matching where condition', async () => {
        await DB.users.createMany([
          { email: 'a@test.com', status: 'pending' },
          { email: 'b@test.com', status: 'pending' },
          { email: 'c@test.com', status: 'active' },
        ]);

        const result = await DB.users
          .where({ status: 'pending' })
          .updateMany({ status: 'processed' });

        expect(result.count).toBe(2);

        const processed = await DB.users
          .where({ status: 'processed' })
          .count();
        expect(processed).toBe(2);
      });

      it('should return count of 0 when no matches', async () => {
        await createUsers(3);

        const result = await DB.users
          .where({ status: 'nonexistent' })
          .updateMany({ status: 'active' });

        expect(result.count).toBe(0);
      });

      it('should handle empty database', async () => {
        const result = await DB.users.updateMany({
          status: 'active',
        });

        expect(result.count).toBe(0);
      });
    });

    describe('Complex Conditions', () => {
      it('should update with AND conditions', async () => {
        await DB.users.createMany([
          { email: 'alice-active@test.com', name: 'Alice', status: 'active' },
          { email: 'alice-pending@test.com', name: 'Alice', status: 'pending' },
          { email: 'bob-active@test.com', name: 'Bob', status: 'active' },
        ]);

        const result = await DB.users
          .where({ name: 'Alice' })
          .where({ status: 'active' })
          .updateMany({ status: 'processed' });

        expect(result.count).toBe(1);
      });

      it('should update with OR conditions', async () => {
        await DB.users.createMany([
          { email: 'a@test.com', status: 'pending' },
          { email: 'b@test.com', status: 'active' },
          { email: 'c@test.com', status: 'banned' },
        ]);

        const result = await DB.users
          .where({ status: 'pending' })
          .orWhere({ status: 'banned' })
          .updateMany({ status: 'inactive' });

        expect(result.count).toBe(2);
      });

      it('should update with NOT condition', async () => {
        await DB.users.createMany([
          { email: 'a@test.com', status: 'active' },
          { email: 'b@test.com', status: 'pending' },
          { email: 'c@test.com', status: 'banned' },
        ]);

        const result = await DB.users
          .where({ NOT: { status: 'banned' } })
          .updateMany({ status: 'processed' });

        expect(result.count).toBe(2);
      });
    });

    describe('Large Batch Updates', () => {
      it('should handle updating 100 records', async () => {
        const data = Array.from({ length: 100 }, (_, i) => ({
          email: `batch-${i}@test.com`,
          status: 'pending',
        }));
        await DB.users.createMany(data);

        const result = await DB.users
          .where({ status: 'pending' })
          .updateMany({ status: 'processed' });

        expect(result.count).toBe(100);
      });
    });

    describe('Data Integrity', () => {
      it('should only update specified fields', async () => {
        await DB.users.createMany([
          { email: 'a@test.com', name: 'Alice', status: 'pending' },
          { email: 'b@test.com', name: 'Bob', status: 'pending' },
        ]);

        await DB.users.where({ status: 'pending' }).updateMany({
          status: 'active',
        });

        const users = await DB.users.order({ email: 'asc' }).findMany();
        expect(users[0].name).toBe('Alice');
        expect(users[1].name).toBe('Bob');
      });
    });
  });

  /**
   * ============================================
   * UPDATE WITH SELECT
   * ============================================
   */
  describe('Update with Select', () => {
    it('should return only selected fields after update', async () => {
      const user = await createUser();

      const updated = await DB.users
        .withId(user.id)
        .select({ id: true, name: true })
        .update({ name: 'Updated' });

      expect(updated).toHaveProperty('id');
      expect(updated).toHaveProperty('name');
      expect(updated).not.toHaveProperty('email');
      expect(updated).not.toHaveProperty('status');
    });
  });

  /**
   * ============================================
   * INTEGRATION SCENARIOS
   * ============================================
   */
  describe('Integration Scenarios', () => {
    it('should update and verify change', async () => {
      const user = await createUser({ status: 'pending' });

      await DB.users.withId(user.id).update({ status: 'active' });

      const verified = await DB.users.withId(user.id).findUnique();
      expect(verified?.status).toBe('active');
    });

    it('should handle concurrent updates to different records', async () => {
      const users = await createUsers(5);

      const updates = users.map((user: { id: number }) =>
        DB.users.withId(user.id).update({ status: 'processed' })
      );

      const results = await Promise.all(updates);

      expect(results.every((r: { status: string }) => r.status === 'processed')).toBe(true);
    });

    it('should cascade update through relations', async () => {
      const { user, posts } = await createUserWithPosts();

      // Update all posts for a user
      await DB.posts.where({ authorId: user.id }).updateMany({
        published: true,
      });

      const updatedPosts = await DB.posts
        .where({ authorId: user.id })
        .findMany();

      expect(updatedPosts.every((p) => p.published === true)).toBe(true);
    });
  });
});
