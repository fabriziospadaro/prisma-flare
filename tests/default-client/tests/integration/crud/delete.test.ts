/**
 * Delete Operations Integration Tests
 *
 * Comprehensive tests for all delete operations:
 * - delete()
 * - deleteMany()
 */

import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import { DB } from 'prisma-flare/generated';
import { cleanDatabase, disconnectPrisma } from '../../helpers/database.js';
import { createUser, createUsers, createUserWithPosts, createPost } from '../../helpers/factories.js';

describe('Delete Operations', () => {
  beforeEach(async () => {
    await cleanDatabase();
  });

  afterAll(async () => {
    await disconnectPrisma();
  });

  /**
   * ============================================
   * SINGLE DELETE
   * ============================================
   */
  describe('delete()', () => {
    describe('Basic Deletion', () => {
      it('should delete a single record by id', async () => {
        const user = await createUser();

        const deleted = await DB.users.withId(user.id).delete();

        expect(deleted.id).toBe(user.id);

        const found = await DB.users.withId(user.id).findUnique();
        expect(found).toBeNull();
      });

      it('should return the deleted record', async () => {
        const user = await createUser({
          email: 'deleted@test.com',
          name: 'Deleted User',
          status: 'active',
        });

        const deleted = await DB.users.withId(user.id).delete();

        expect(deleted).toHaveProperty('id', user.id);
        expect(deleted).toHaveProperty('email', 'deleted@test.com');
        expect(deleted).toHaveProperty('name', 'Deleted User');
        expect(deleted).toHaveProperty('status', 'active');
      });

      it('should delete using where condition', async () => {
        const user = await createUser({ email: 'target@test.com' });

        const deleted = await DB.users
          .where({ email: 'target@test.com' })
          .delete();

        expect(deleted.id).toBe(user.id);
      });
    });

    describe('Delete with Relations', () => {
      it('should delete record with no dependents', async () => {
        const user = await createUser();

        await DB.users.withId(user.id).delete();

        expect(await DB.users.count()).toBe(0);
      });

      it('should throw error when deleting record with dependents', async () => {
        const { user, posts } = await createUserWithPosts();

        // Should fail because posts reference this user
        await expect(
          DB.users.withId(user.id).delete()
        ).rejects.toThrow();

        // User should still exist
        const found = await DB.users.withId(user.id).findUnique();
        expect(found).not.toBeNull();
      });

      it('should succeed after deleting dependents first', async () => {
        const { user } = await createUserWithPosts();

        // First delete posts
        await DB.posts.where({ authorId: user.id }).deleteMany();

        // Now user can be deleted
        await DB.users.withId(user.id).delete();

        expect(await DB.users.count()).toBe(0);
        expect(await DB.posts.count()).toBe(0);
      });
    });

    describe('Error Handling', () => {
      it('should throw error for non-existent record', async () => {
        await expect(
          DB.users.withId(99999).delete()
        ).rejects.toThrow();
      });

      it('should throw error for non-matching where condition', async () => {
        await createUser({ email: 'existing@test.com' });

        await expect(
          DB.users.where({ email: 'nonexistent@test.com' }).delete()
        ).rejects.toThrow();
      });
    });
  });

  /**
   * ============================================
   * BATCH DELETE
   * ============================================
   */
  describe('deleteMany()', () => {
    describe('Basic Batch Deletion', () => {
      it('should delete all records when no condition', async () => {
        await createUsers(5);

        const result = await DB.users.deleteMany();

        expect(result.count).toBe(5);
        expect(await DB.users.count()).toBe(0);
      });

      it('should delete records matching condition', async () => {
        await DB.users.createMany([
          { email: 'a@test.com', status: 'pending' },
          { email: 'b@test.com', status: 'pending' },
          { email: 'c@test.com', status: 'active' },
        ]);

        const result = await DB.users
          .where({ status: 'pending' })
          .deleteMany();

        expect(result.count).toBe(2);
        expect(await DB.users.count()).toBe(1);
      });

      it('should return 0 count when no matches', async () => {
        await createUsers(3);

        const result = await DB.users
          .where({ status: 'nonexistent' })
          .deleteMany();

        expect(result.count).toBe(0);
        expect(await DB.users.count()).toBe(3);
      });

      it('should handle empty database', async () => {
        const result = await DB.users.deleteMany();

        expect(result.count).toBe(0);
      });
    });

    describe('Complex Conditions', () => {
      it('should delete with AND conditions', async () => {
        await DB.users.createMany([
          { email: 'a@test.com', name: 'Alice', status: 'active' },
          { email: 'b@test.com', name: 'Alice', status: 'pending' },
          { email: 'c@test.com', name: 'Bob', status: 'active' },
        ]);

        const result = await DB.users
          .where({ name: 'Alice' })
          .where({ status: 'active' })
          .deleteMany();

        expect(result.count).toBe(1);
        expect(await DB.users.count()).toBe(2);
      });

      it('should delete with OR conditions', async () => {
        await DB.users.createMany([
          { email: 'a@test.com', status: 'pending' },
          { email: 'b@test.com', status: 'active' },
          { email: 'c@test.com', status: 'banned' },
        ]);

        const result = await DB.users
          .where({ status: 'pending' })
          .orWhere({ status: 'banned' })
          .deleteMany();

        expect(result.count).toBe(2);
        expect(await DB.users.count()).toBe(1);
      });

      it('should delete with NOT condition', async () => {
        await DB.users.createMany([
          { email: 'a@test.com', status: 'active' },
          { email: 'b@test.com', status: 'pending' },
          { email: 'c@test.com', status: 'banned' },
        ]);

        const result = await DB.users
          .where({ NOT: { status: 'active' } })
          .deleteMany();

        expect(result.count).toBe(2);

        const remaining = await DB.users.findMany();
        expect(remaining[0].status).toBe('active');
      });

      it('should delete with whereGroup', async () => {
        await DB.users.createMany([
          { email: 'alice-active@test.com', name: 'Alice', status: 'active' },
          { email: 'bob-active@test.com', name: 'Bob', status: 'active' },
          { email: 'alice-pending@test.com', name: 'Alice', status: 'pending' },
          { email: 'charlie-active@test.com', name: 'Charlie', status: 'active' },
        ]);

        // Delete active users named Alice or Bob
        const result = await DB.users
          .where({ status: 'active' })
          .whereGroup((qb) =>
            qb.where({ name: 'Alice' }).orWhere({ name: 'Bob' })
          )
          .deleteMany();

        expect(result.count).toBe(2);
        expect(await DB.users.count()).toBe(2);
      });
    });

    describe('Large Batch Deletion', () => {
      it('should delete 100 records', async () => {
        const data = Array.from({ length: 100 }, (_, i) => ({
          email: `batch-${i}@test.com`,
        }));
        await DB.users.createMany(data);

        const result = await DB.users.deleteMany();

        expect(result.count).toBe(100);
      });

      it('should delete 500 records efficiently', async () => {
        const data = Array.from({ length: 500 }, (_, i) => ({
          email: `large-${i}@test.com`,
          status: 'pending',
        }));
        await DB.users.createMany(data);

        const startTime = Date.now();
        const result = await DB.users.deleteMany();
        const duration = Date.now() - startTime;

        expect(result.count).toBe(500);
        // Should complete in reasonable time (5 seconds max for SQLite)
        expect(duration).toBeLessThan(5000);
      });
    });

    describe('With Relations', () => {
      it('should delete posts before users', async () => {
        const users = await createUsers(3);
        for (const user of users) {
          await createPost({ authorId: user.id });
          await createPost({ authorId: user.id });
        }

        expect(await DB.posts.count()).toBe(6);

        // Delete all posts first
        await DB.posts.deleteMany();

        // Now delete users
        await DB.users.deleteMany();

        expect(await DB.users.count()).toBe(0);
        expect(await DB.posts.count()).toBe(0);
      });

      it('should delete posts for specific user', async () => {
        const user1 = await createUser();
        const user2 = await createUser();

        await createPost({ authorId: user1.id });
        await createPost({ authorId: user1.id });
        await createPost({ authorId: user2.id });

        const result = await DB.posts
          .where({ authorId: user1.id })
          .deleteMany();

        expect(result.count).toBe(2);
        expect(await DB.posts.count()).toBe(1);
      });
    });
  });

  /**
   * ============================================
   * INTEGRATION SCENARIOS
   * ============================================
   */
  describe('Integration Scenarios', () => {
    it('should delete and verify deletion', async () => {
      const user = await createUser({ email: 'verify@test.com' });

      await DB.users.withId(user.id).delete();

      const count = await DB.users.count();
      const found = await DB.users.where({ email: 'verify@test.com' }).findFirst();

      expect(count).toBe(0);
      expect(found).toBeNull();
    });

    it('should handle concurrent deletes', async () => {
      const users = await createUsers(10);

      const deletes = users.map((user: { id: number }) =>
        DB.users.withId(user.id).delete()
      );

      await Promise.all(deletes);

      expect(await DB.users.count()).toBe(0);
    });

    it('should cascade delete correctly', async () => {
      // Create complex hierarchy
      const user1 = await createUser();
      const user2 = await createUser();

      await createPost({ authorId: user1.id });
      await createPost({ authorId: user1.id });
      await createPost({ authorId: user2.id });

      // Delete user1's posts, then user1
      await DB.posts.where({ authorId: user1.id }).deleteMany();
      await DB.users.withId(user1.id).delete();

      expect(await DB.users.count()).toBe(1);
      expect(await DB.posts.count()).toBe(1);

      // Verify remaining data
      const remainingUser = await DB.users.findFirst();
      const remainingPost = await DB.posts.findFirst();

      expect(remainingUser?.id).toBe(user2.id);
      expect(remainingPost?.authorId).toBe(user2.id);
    });

    it('should delete based on related data', async () => {
      const activeUser = await createUser({ status: 'active' });
      const inactiveUser = await createUser({ status: 'inactive' });

      await createPost({ authorId: activeUser.id, published: true });
      await createPost({ authorId: inactiveUser.id, published: false });

      // Delete unpublished posts
      await DB.posts.where({ published: false }).deleteMany();

      // Delete users with no posts
      const usersWithPosts = await DB.posts.pluck('authorId');
      await DB.users
        .where({ id: { notIn: usersWithPosts } })
        .deleteMany();

      expect(await DB.users.count()).toBe(1);
      expect(await DB.posts.count()).toBe(1);
    });
  });

  /**
   * ============================================
   * EDGE CASES
   * ============================================
   */
  describe('Edge Cases', () => {
    it('should handle delete immediately after create', async () => {
      const user = await createUser();

      const deleted = await DB.users.withId(user.id).delete();

      expect(deleted.id).toBe(user.id);
    });

    it('should handle multiple deleteMany in sequence', async () => {
      // Create users with different statuses
      await DB.users.createMany([
        { email: 'a@test.com', status: 'pending' },
        { email: 'b@test.com', status: 'pending' },
        { email: 'c@test.com', status: 'active' },
        { email: 'd@test.com', status: 'active' },
      ]);

      // Delete first batch - pending users
      await DB.users.where({ status: 'pending' }).deleteMany();
      expect(await DB.users.count()).toBe(2);

      // Delete remaining - active users
      await DB.users.where({ status: 'active' }).deleteMany();
      const finalCount = await DB.users.count();

      expect(finalCount).toBe(0);
    });

    it('should not affect other records', async () => {
      const keep = await createUser({ email: 'keep@test.com' });
      const remove = await createUser({ email: 'remove@test.com' });

      await DB.users.withId(remove.id).delete();

      const found = await DB.users.withId(keep.id).findUnique();
      expect(found).not.toBeNull();
      expect(found?.email).toBe('keep@test.com');
    });
  });
});
