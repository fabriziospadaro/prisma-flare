/**
 * Read Operations Integration Tests
 *
 * Comprehensive tests for all read operations:
 * - findMany()
 * - findFirst()
 * - findUnique()
 * - findFirstOrThrow()
 * - findUniqueOrThrow()
 * - count()
 * - exists()
 */

import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import { DB } from 'prisma-flare/generated';
import { cleanDatabase, disconnectPrisma } from '../../helpers/database.js';
import {
  createUser,
  createUsers,
  createUserWithPosts,
  createUsersWithNames,
  createUsersWithStatuses,
} from '../../helpers/factories.js';
import { assertSortedBy, assertContainsIds } from '../../helpers/assertions.js';

describe('Read Operations', () => {
  beforeEach(async () => {
    await cleanDatabase();
  });

  afterAll(async () => {
    await disconnectPrisma();
  });

  /**
   * ============================================
   * FIND MANY
   * ============================================
   */
  describe('findMany()', () => {
    describe('Basic Queries', () => {
      it('should return empty array when no records', async () => {
        const users = await DB.users.findMany();

        expect(users).toEqual([]);
      });

      it('should return all records', async () => {
        await createUsers(5);

        const users = await DB.users.findMany();

        expect(users).toHaveLength(5);
      });

      it('should return records with all fields', async () => {
        await createUser({ email: 'complete@test.com', name: 'Complete', status: 'active' });

        const users = await DB.users.findMany();

        expect(users[0]).toHaveProperty('id');
        expect(users[0]).toHaveProperty('email');
        expect(users[0]).toHaveProperty('name');
        expect(users[0]).toHaveProperty('status');
        expect(users[0]).toHaveProperty('createdAt');
        expect(users[0]).toHaveProperty('updatedAt');
      });
    });

    describe('With Where Conditions', () => {
      it('should filter by exact match', async () => {
        await createUsersWithStatuses(['active', 'active', 'pending', 'banned']);

        const users = await DB.users.where({ status: 'active' }).findMany();

        expect(users).toHaveLength(2);
        expect(users.every((u) => u.status === 'active')).toBe(true);
      });

      it('should filter by contains', async () => {
        await createUsersWithNames(['Alice Smith', 'Bob Smith', 'Charlie Brown']);

        const users = await DB.users
          .where({ name: { contains: 'Smith' } })
          .findMany();

        expect(users).toHaveLength(2);
      });

      it('should filter by startsWith', async () => {
        await createUsersWithNames(['Alice', 'Alfred', 'Bob']);

        const users = await DB.users
          .where({ name: { startsWith: 'Al' } })
          .findMany();

        expect(users).toHaveLength(2);
      });

      it('should filter by endsWith', async () => {
        await createUsersWithNames(['Alice', 'Grace', 'Bob']);

        const users = await DB.users
          .where({ name: { endsWith: 'ce' } })
          .findMany();

        expect(users).toHaveLength(2);
      });

      it('should filter with NOT condition', async () => {
        await createUsersWithStatuses(['active', 'pending', 'banned']);

        const users = await DB.users
          .where({ NOT: { status: 'banned' } })
          .findMany();

        expect(users).toHaveLength(2);
        expect(users.every((u) => u.status !== 'banned')).toBe(true);
      });

      it('should return empty array when no matches', async () => {
        await createUsers(3);

        const users = await DB.users
          .where({ status: 'nonexistent' })
          .findMany();

        expect(users).toEqual([]);
      });
    });

    describe('With Ordering', () => {
      it('should order by field ascending', async () => {
        await createUsersWithNames(['Charlie', 'Alice', 'Bob']);

        const users = await DB.users.order({ name: 'asc' }).findMany();

        assertSortedBy(users, 'name', 'asc');
        expect(users[0].name).toBe('Alice');
      });

      it('should order by field descending', async () => {
        await createUsersWithNames(['Alice', 'Charlie', 'Bob']);

        const users = await DB.users.order({ name: 'desc' }).findMany();

        assertSortedBy(users, 'name', 'desc');
        expect(users[0].name).toBe('Charlie');
      });

      it('should order by createdAt', async () => {
        const user1 = await createUser();
        const user2 = await createUser();
        const user3 = await createUser();

        const users = await DB.users.order({ createdAt: 'asc' }).findMany();

        expect(users[0].id).toBe(user1.id);
        expect(users[2].id).toBe(user3.id);
      });
    });

    describe('With Pagination', () => {
      it('should limit results', async () => {
        await createUsers(10);

        const users = await DB.users.limit(3).findMany();

        expect(users).toHaveLength(3);
      });

      it('should skip results', async () => {
        const created = await createUsers(5);
        const sortedIds = created.map((u: { id: number }) => u.id).sort((a: number, b: number) => a - b);

        const users = await DB.users.order({ id: 'asc' }).skip(2).findMany();

        expect(users).toHaveLength(3);
        expect(users[0].id).toBe(sortedIds[2]);
      });

      it('should combine skip and limit', async () => {
        await createUsers(10);

        const users = await DB.users
          .order({ id: 'asc' })
          .skip(3)
          .limit(2)
          .findMany();

        expect(users).toHaveLength(2);
      });

      it('should return empty when skip exceeds count', async () => {
        await createUsers(3);

        const users = await DB.users.skip(10).findMany();

        expect(users).toEqual([]);
      });
    });

    describe('With Select', () => {
      it('should return only selected fields', async () => {
        await createUser({ email: 'select@test.com', name: 'Select', status: 'active' });

        const users = await DB.users.select({ email: true, name: true }).findMany();

        expect(users[0]).toHaveProperty('email');
        expect(users[0]).toHaveProperty('name');
        expect(users[0]).not.toHaveProperty('status');
        expect(users[0]).not.toHaveProperty('createdAt');
      });

      it('should select only id', async () => {
        await createUser();

        const users = await DB.users.select({ id: true }).findMany();

        expect(Object.keys(users[0])).toEqual(['id']);
      });
    });

    describe('With Include', () => {
      it('should include relation', async () => {
        const { user, posts } = await createUserWithPosts();

        const users = await DB.users
          .withId(user.id)
          .include('posts')
          .findMany();

        expect(users[0].posts).toBeDefined();
        expect(users[0].posts).toHaveLength(posts.length);
      });

      it('should include filtered relation', async () => {
        const user = await createUser();
        await DB.posts.createMany([
          { title: 'Published', authorId: user.id, published: true },
          { title: 'Draft', authorId: user.id, published: false },
        ]);

        const users = await DB.users
          .withId(user.id)
          .include('posts', (posts) => posts.where({ published: true }))
          .findMany();

        expect(users[0].posts).toHaveLength(1);
        expect(users[0].posts[0].published).toBe(true);
      });
    });
  });

  /**
   * ============================================
   * FIND FIRST
   * ============================================
   */
  describe('findFirst()', () => {
    it('should return null when no records', async () => {
      const user = await DB.users.findFirst();

      expect(user).toBeNull();
    });

    it('should return first matching record', async () => {
      await createUser({ email: 'first@test.com' });
      await createUser({ email: 'second@test.com' });

      const user = await DB.users.order({ id: 'asc' }).findFirst();

      expect(user).toBeDefined();
      expect(user?.email).toBe('first@test.com');
    });

    it('should respect where condition', async () => {
      await createUsersWithStatuses(['pending', 'active', 'pending']);

      const user = await DB.users.where({ status: 'active' }).findFirst();

      expect(user?.status).toBe('active');
    });

    it('should return null when no match', async () => {
      await createUsers(3);

      const user = await DB.users.where({ status: 'nonexistent' }).findFirst();

      expect(user).toBeNull();
    });
  });

  /**
   * ============================================
   * FIND UNIQUE
   * ============================================
   */
  describe('findUnique()', () => {
    it('should find by id', async () => {
      const created = await createUser();

      const user = await DB.users.withId(created.id).findUnique();

      expect(user).toBeDefined();
      expect(user?.id).toBe(created.id);
    });

    it('should return null for non-existent id', async () => {
      const user = await DB.users.withId(99999).findUnique();

      expect(user).toBeNull();
    });

    it('should find by unique email', async () => {
      await createUser({ email: 'unique@test.com' });

      const user = await DB.users.where({ email: 'unique@test.com' }).findUnique();

      expect(user?.email).toBe('unique@test.com');
    });
  });

  /**
   * ============================================
   * FIND OR THROW
   * ============================================
   */
  describe('findFirstOrThrow()', () => {
    it('should return record when exists', async () => {
      await createUser({ email: 'exists@test.com' });

      const user = await DB.users.where({ email: 'exists@test.com' }).findFirstOrThrow();

      expect(user.email).toBe('exists@test.com');
    });

    it('should throw when no record found', async () => {
      await expect(
        DB.users.where({ email: 'nonexistent@test.com' }).findFirstOrThrow()
      ).rejects.toThrow();
    });
  });

  describe('findUniqueOrThrow()', () => {
    it('should return record when exists', async () => {
      const created = await createUser();

      const user = await DB.users.withId(created.id).findUniqueOrThrow();

      expect(user.id).toBe(created.id);
    });

    it('should throw when no record found', async () => {
      await expect(
        DB.users.withId(99999).findUniqueOrThrow()
      ).rejects.toThrow();
    });
  });

  /**
   * ============================================
   * COUNT AND EXISTS
   * ============================================
   */
  describe('count()', () => {
    it('should return 0 when no records', async () => {
      const count = await DB.users.count();

      expect(count).toBe(0);
    });

    it('should return total count', async () => {
      await createUsers(7);

      const count = await DB.users.count();

      expect(count).toBe(7);
    });

    it('should count with where condition', async () => {
      await createUsersWithStatuses(['active', 'active', 'pending', 'banned']);

      const count = await DB.users.where({ status: 'active' }).count();

      expect(count).toBe(2);
    });
  });

  describe('exists()', () => {
    it('should return false when no records', async () => {
      const exists = await DB.users.exists();

      expect(exists).toBe(false);
    });

    it('should return true when records exist', async () => {
      await createUser();

      const exists = await DB.users.exists();

      expect(exists).toBe(true);
    });

    it('should check existence with where condition', async () => {
      await createUser({ status: 'pending' });

      const existsActive = await DB.users.where({ status: 'active' }).exists();
      const existsPending = await DB.users.where({ status: 'pending' }).exists();

      expect(existsActive).toBe(false);
      expect(existsPending).toBe(true);
    });
  });

  /**
   * ============================================
   * FIRST AND LAST HELPERS
   * ============================================
   */
  describe('first() and last()', () => {
    it('should return first record by createdAt', async () => {
      const first = await createUser();
      await new Promise((r) => setTimeout(r, 10)); // Ensure different timestamp
      await createUser();
      await new Promise((r) => setTimeout(r, 10));
      await createUser();

      const user = await DB.users.first().findFirst();

      expect(user?.id).toBe(first.id);
    });

    it('should return last record by createdAt', async () => {
      await createUser();
      await new Promise((r) => setTimeout(r, 10)); // Ensure different timestamp
      await createUser();
      await new Promise((r) => setTimeout(r, 10));
      const last = await createUser();

      const user = await DB.users.last().findFirst();

      expect(user?.id).toBe(last.id);
    });

    it('should use custom field for first', async () => {
      await createUsersWithNames(['Charlie', 'Alice', 'Bob']);

      const user = await DB.users.first('name').findFirst();

      expect(user?.name).toBe('Alice');
    });

    it('should use custom field for last', async () => {
      await createUsersWithNames(['Alice', 'Charlie', 'Bob']);

      const user = await DB.users.last('name').findFirst();

      expect(user?.name).toBe('Charlie');
    });
  });

  /**
   * ============================================
   * ONLY AND PLUCK
   * ============================================
   */
  describe('only()', () => {
    it('should return single field value', async () => {
      await createUser({ email: 'only@test.com', name: 'Only User' });

      const name = await DB.users.where({ email: 'only@test.com' }).only('name');

      expect(name).toBe('Only User');
    });

    it('should return null when no match', async () => {
      const name = await DB.users.where({ email: 'nonexistent@test.com' }).only('name');

      expect(name).toBeNull();
    });
  });

  describe('pluck()', () => {
    it('should return array of single field values', async () => {
      await createUsersWithNames(['Alice', 'Bob', 'Charlie']);

      const names = await DB.users.order({ name: 'asc' }).pluck('name');

      expect(names).toEqual(['Alice', 'Bob', 'Charlie']);
    });

    it('should return empty array when no records', async () => {
      const names = await DB.users.pluck('name');

      expect(names).toEqual([]);
    });

    it('should respect where condition', async () => {
      await Promise.all([
        createUser({ name: 'Active', status: 'active' }),
        createUser({ name: 'Pending', status: 'pending' }),
      ]);

      const names = await DB.users.where({ status: 'active' }).pluck('name');

      expect(names).toEqual(['Active']);
    });
  });

  /**
   * ============================================
   * COMPLEX QUERIES
   * ============================================
   */
  describe('Complex Queries', () => {
    it('should combine multiple conditions', async () => {
      await createUsersWithStatuses(['active', 'active', 'pending']);
      await createUsersWithNames(['Alice Active', 'Bob Active', 'Charlie Pending']);

      // Note: These are different users created separately
      // Let's create proper test data
      await cleanDatabase();
      await DB.users.createMany([
        { email: 'alice@test.com', name: 'Alice', status: 'active' },
        { email: 'bob@test.com', name: 'Bob', status: 'active' },
        { email: 'charlie@test.com', name: 'Charlie', status: 'pending' },
      ]);

      const users = await DB.users
        .where({ status: 'active' })
        .where({ name: { contains: 'ob' } })
        .findMany();

      expect(users).toHaveLength(1);
      expect(users[0].name).toBe('Bob');
    });

    it('should handle pagination with filtering and ordering', async () => {
      await cleanDatabase();
      // Create 20 active users
      for (let i = 0; i < 20; i++) {
        await createUser({ name: `User ${i.toString().padStart(2, '0')}`, status: 'active' });
      }
      // Create 5 inactive users
      for (let i = 0; i < 5; i++) {
        await createUser({ status: 'inactive' });
      }

      const users = await DB.users
        .where({ status: 'active' })
        .order({ name: 'asc' })
        .skip(5)
        .limit(5)
        .findMany();

      expect(users).toHaveLength(5);
      expect(users[0].name).toBe('User 05');
      expect(users[4].name).toBe('User 09');
    });
  });
});
