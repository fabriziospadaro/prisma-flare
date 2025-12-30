/**
 * Edge Cases and Error Handling Tests
 *
 * Tests for edge cases, error handling, null values, empty results,
 * and complex query scenarios.
 */

import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import {
  DB,
  cleanDatabase,
  disconnect,
  createUser,
  createUserWithPosts,
  uniqueEmail,
} from '#test-helpers';

describe('Edge Cases and Error Handling', () => {
  beforeEach(async () => {
    await cleanDatabase();
  });

  afterAll(async () => {
    await disconnect();
  });

  // ==================== EMPTY RESULTS ====================
  describe('Empty Results', () => {
    it('findMany returns empty array on empty table', async () => {
      const users = await DB.users.findMany();
      expect(users).toEqual([]);
      expect(Array.isArray(users)).toBe(true);
    });

    it('findFirst returns null on empty table', async () => {
      const user = await DB.users.findFirst();
      expect(user).toBeNull();
    });

    it('findUnique returns null for non-existent id', async () => {
      const user = await DB.users.withId(99999).findUnique();
      expect(user).toBeNull();
    });

    it('count returns 0 on empty table', async () => {
      const count = await DB.users.count();
      expect(count).toBe(0);
    });

    it('exists returns false on empty table', async () => {
      const exists = await DB.users.exists();
      expect(exists).toBe(false);
    });

    it('sum returns null on empty table', async () => {
      const sum = await DB.posts.sum('views');
      expect(sum).toBeNull();
    });

    it('avg returns null on empty table', async () => {
      const avg = await DB.posts.avg('views');
      expect(avg).toBeNull();
    });
  });

  // ==================== NULL VALUES ====================
  describe('Null Values', () => {
    it('creates record with null optional fields', async () => {
      const user = await DB.users.create({
        email: uniqueEmail(),
        name: null,
      });

      expect(user.name).toBeNull();
    });

    it('finds records with null fields', async () => {
      await DB.users.create({ email: uniqueEmail(), name: null });
      await DB.users.create({ email: uniqueEmail(), name: 'Has Name' });

      const usersWithNull = await DB.users
        .where({ name: null })
        .findMany();

      expect(usersWithNull).toHaveLength(1);
      expect(usersWithNull[0].name).toBeNull();
    });

    it('finds records where field is NOT null', async () => {
      await DB.users.create({ email: uniqueEmail(), name: null });
      await DB.users.create({ email: uniqueEmail(), name: 'Has Name' });

      const usersWithName = await DB.users
        .where({ name: { not: null } })
        .findMany();

      expect(usersWithName).toHaveLength(1);
      expect(usersWithName[0].name).toBe('Has Name');
    });

    it('updates to null', async () => {
      const user = await createUser({ name: 'Has Name', email: uniqueEmail() });

      const updated = await DB.users.withId(user.id).update({ name: null });

      expect(updated.name).toBeNull();
    });
  });

  // ==================== THROWS ====================
  describe('OrThrow Methods', () => {
    it('findFirstOrThrow throws when no record found', async () => {
      await expect(DB.users.findFirstOrThrow()).rejects.toThrow();
    });

    it('findUniqueOrThrow throws when record not found', async () => {
      await expect(
        DB.users.withId(99999).findUniqueOrThrow()
      ).rejects.toThrow();
    });

    it('findFirstOrThrow returns record when exists', async () => {
      await createUser({ email: uniqueEmail() });

      const user = await DB.users.findFirstOrThrow();
      expect(user).toBeDefined();
      expect(user.id).toBeDefined();
    });

    it('findUniqueOrThrow returns record when exists', async () => {
      const created = await createUser({ email: uniqueEmail() });

      const user = await DB.users.withId(created.id).findUniqueOrThrow();
      expect(user.id).toBe(created.id);
    });
  });

  // ==================== CONSTRAINT VIOLATIONS ====================
  describe('Constraint Violations', () => {
    it('throws on unique constraint violation', async () => {
      const email = uniqueEmail();
      await createUser({ email });

      await expect(
        DB.users.create({ email })
      ).rejects.toThrow();
    });

    it('throws on foreign key violation', async () => {
      await expect(
        DB.posts.create({
          title: 'Orphan Post',
          authorId: 99999, // Non-existent user
        })
      ).rejects.toThrow();
    });
  });

  // ==================== COMPLEX WHERE CONDITIONS ====================
  describe('Complex Where Conditions', () => {
    beforeEach(async () => {
      await DB.users.createMany([
        { email: 'user1@test.com', name: 'Alice', status: 'active' },
        { email: 'user2@test.com', name: 'Bob', status: 'active' },
        { email: 'user3@test.com', name: 'Charlie', status: 'pending' },
        { email: 'user4@test.com', name: 'Diana', status: 'inactive' },
        { email: 'user5@test.com', name: null, status: 'active' },
      ]);
    });

    it('handles complex AND conditions', async () => {
      const users = await DB.users
        .where({
          status: 'active',
          name: { not: null },
        })
        .findMany();

      expect(users).toHaveLength(2); // Alice and Bob
    });

    it('handles OR with AND conditions', async () => {
      const users = await DB.users
        .where({
          OR: [
            { status: 'active', name: { contains: 'A' } },
            { status: 'pending' },
          ],
        })
        .findMany();

      expect(users).toHaveLength(2); // Alice and Charlie
    });

    it('handles nested NOT conditions', async () => {
      const users = await DB.users
        .where({
          NOT: {
            OR: [{ status: 'inactive' }, { name: null }],
          },
        })
        .findMany();

      expect(users).toHaveLength(3); // Alice, Bob, Charlie
    });

    it('filters with in array', async () => {
      const users = await DB.users
        .where({ status: { in: ['active', 'pending'] } })
        .findMany();

      expect(users).toHaveLength(4);
    });

    it('filters with notIn array', async () => {
      const users = await DB.users
        .where({ status: { notIn: ['inactive'] } })
        .findMany();

      expect(users).toHaveLength(4);
    });
  });

  // ==================== NUMERIC COMPARISONS ====================
  describe('Numeric Comparisons', () => {
    beforeEach(async () => {
      const user = await createUser({ email: uniqueEmail() });
      await DB.posts.createMany([
        { title: 'Post 1', authorId: user.id, views: 10 },
        { title: 'Post 2', authorId: user.id, views: 50 },
        { title: 'Post 3', authorId: user.id, views: 100 },
        { title: 'Post 4', authorId: user.id, views: 200 },
      ]);
    });

    it('filters with gt (greater than)', async () => {
      const posts = await DB.posts.where({ views: { gt: 50 } }).findMany();
      expect(posts).toHaveLength(2);
    });

    it('filters with gte (greater than or equal)', async () => {
      const posts = await DB.posts.where({ views: { gte: 50 } }).findMany();
      expect(posts).toHaveLength(3);
    });

    it('filters with lt (less than)', async () => {
      const posts = await DB.posts.where({ views: { lt: 100 } }).findMany();
      expect(posts).toHaveLength(2);
    });

    it('filters with lte (less than or equal)', async () => {
      const posts = await DB.posts.where({ views: { lte: 100 } }).findMany();
      expect(posts).toHaveLength(3);
    });

    it('combines numeric comparisons', async () => {
      const posts = await DB.posts
        .where({ views: { gte: 50, lte: 100 } })
        .findMany();
      expect(posts).toHaveLength(2); // 50 and 100
    });
  });

  // ==================== STRING OPERATIONS ====================
  describe('String Operations', () => {
    beforeEach(async () => {
      await DB.users.createMany([
        { email: 'alice@example.com', name: 'Alice Smith' },
        { email: 'bob@test.com', name: 'Bob Johnson' },
        { email: 'charlie@example.org', name: 'CHARLIE BROWN' },
      ]);
    });

    it('filters with contains', async () => {
      const users = await DB.users
        .where({ name: { contains: 'Smith' } })
        .findMany();
      expect(users).toHaveLength(1);
    });

    it('filters with startsWith', async () => {
      const users = await DB.users
        .where({ email: { startsWith: 'alice' } })
        .findMany();
      expect(users).toHaveLength(1);
    });

    it('filters with endsWith', async () => {
      const users = await DB.users
        .where({ email: { endsWith: '.com' } })
        .findMany();
      expect(users).toHaveLength(2);
    });

    // Note: mode: 'insensitive' is only supported in PostgreSQL/MySQL, not SQLite
    // Skipped and commented out to avoid type errors in SQLite projects
    // it('filters case-insensitive with mode (PostgreSQL/MySQL only)', async () => {
    //   const users = await DB.users
    //     .where({ name: { contains: 'charlie', mode: 'insensitive' } })
    //     .findMany();
    //   expect(users).toHaveLength(1);
    // });
  });

  // ==================== CHAINING ORDER ====================
  describe('Method Chaining Order', () => {
    beforeEach(async () => {
      await DB.users.createMany([
        { email: 'a@test.com', name: 'Alice', status: 'active' },
        { email: 'b@test.com', name: 'Bob', status: 'active' },
        { email: 'c@test.com', name: 'Charlie', status: 'pending' },
      ]);
    });

    it('where-order-limit chain', async () => {
      const users = await DB.users
        .where({ status: 'active' })
        .order({ name: 'desc' })
        .limit(1)
        .findMany();

      expect(users).toHaveLength(1);
      expect(users[0].name).toBe('Bob');
    });

    it('order-skip-limit chain', async () => {
      const users = await DB.users
        .order({ name: 'asc' })
        .skip(1)
        .limit(1)
        .findMany();

      expect(users).toHaveLength(1);
      expect(users[0].name).toBe('Bob');
    });

    it('multiple where chains accumulate (AND)', async () => {
      const users = await DB.users
        .where({ status: 'active' })
        .where({ name: { startsWith: 'A' } })
        .findMany();

      expect(users).toHaveLength(1);
      expect(users[0].name).toBe('Alice');
    });
  });

  // ==================== PAGINATION EDGE CASES ====================
  describe('Pagination Edge Cases', () => {
    beforeEach(async () => {
      for (let i = 1; i <= 5; i++) {
        await DB.users.create({ email: `user${i}@test.com` });
      }
    });

    it('paginate with page beyond results', async () => {
      const result = await DB.users.paginate(100, 10);

      expect(result.data).toHaveLength(0);
      expect(result.meta.total).toBe(5);
      expect(result.meta.currentPage).toBe(100);
    });

    it('paginate first page', async () => {
      const result = await DB.users.paginate(1, 2);

      expect(result.data).toHaveLength(2);
      expect(result.meta.prev).toBeNull();
      expect(result.meta.next).toBe(2);
    });

    it('paginate last page', async () => {
      const result = await DB.users.paginate(3, 2); // 5 users, 2 per page = 3 pages

      expect(result.data).toHaveLength(1);
      expect(result.meta.prev).toBe(2);
      expect(result.meta.next).toBeNull();
    });

    it('skip beyond total returns empty', async () => {
      const users = await DB.users.skip(100).findMany();
      expect(users).toHaveLength(0);
    });

    it('limit 0 returns empty array', async () => {
      const users = await DB.users.limit(0).findMany();
      expect(users).toHaveLength(0);
    });
  });

  // ==================== UPDATE/DELETE OPERATIONS ====================
  describe('Update/Delete Edge Cases', () => {
    it('updateMany with no matches returns count 0', async () => {
      const result = await DB.users
        .where({ status: 'nonexistent' })
        .updateMany({ name: 'Updated' });

      expect(result.count).toBe(0);
    });

    it('deleteMany with no matches returns count 0', async () => {
      const result = await DB.users
        .where({ status: 'nonexistent' })
        .deleteMany();

      expect(result.count).toBe(0);
    });

    it('update non-existent record throws', async () => {
      await expect(
        DB.users.withId(99999).update({ name: 'Updated' })
      ).rejects.toThrow();
    });

    it('delete non-existent record throws', async () => {
      await expect(
        DB.users.withId(99999).delete()
      ).rejects.toThrow();
    });
  });

  // ==================== RELATION EDGE CASES ====================
  describe('Relation Edge Cases', () => {
    it('include on record with no relations', async () => {
      const user = await createUser({ email: uniqueEmail() });

      const userWithPosts = await DB.users
        .withId(user.id)
        .include('posts')
        .findUnique();

      expect(userWithPosts?.posts).toEqual([]);
    });

    it('nested include depth', async () => {
      const { user, posts } = await createUserWithPosts({}, 2);

      const foundPost = await DB.posts
        .withId(posts[0].id)
        .include('author')
        .findUnique();

      expect(foundPost?.author.id).toBe(user.id);
    });
  });
});
