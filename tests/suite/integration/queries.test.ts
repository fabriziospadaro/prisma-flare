/**
 * Query Building Tests
 *
 * Tests where conditions, ordering, pagination, select, and query composition.
 */

import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import { DB } from 'prisma-flare/generated';
import { hookRegistry } from 'prisma-flare';
import { cleanDatabase, disconnect, resetCounter, uniqueEmail } from '#test-helpers';

describe('Query Building', () => {
  beforeEach(async () => {
    await cleanDatabase();
    hookRegistry.clearAll();
    resetCounter();
  });

  afterAll(async () => {
    await disconnect();
  });

  // ==================== WHERE ====================
  describe('where conditions', () => {
    beforeEach(async () => {
      await DB.users.createMany([
        { email: 'alice@test.com', name: 'Alice', status: 'active' },
        { email: 'bob@test.com', name: 'Bob', status: 'active' },
        { email: 'charlie@test.com', name: 'Charlie', status: 'pending' },
        { email: 'david@test.com', name: 'David', status: 'inactive' },
      ]);
    });

    it('filters by exact match', async () => {
      const users = await DB.users.where({ status: 'active' }).findMany();

      expect(users).toHaveLength(2);
      expect(users.every(u => u.status === 'active')).toBe(true);
    });

    it('filters with contains', async () => {
      const users = await DB.users
        .where({ name: { contains: 'li' } })
        .findMany();

      expect(users).toHaveLength(2); // Alice, Charlie
    });

    it('filters with startsWith', async () => {
      const users = await DB.users
        .where({ name: { startsWith: 'A' } })
        .findMany();

      expect(users).toHaveLength(1);
      expect(users[0].name).toBe('Alice');
    });

    it('filters with NOT', async () => {
      const users = await DB.users
        .where({ NOT: { status: 'inactive' } })
        .findMany();

      expect(users).toHaveLength(3);
      expect(users.every(u => u.status !== 'inactive')).toBe(true);
    });

    it('chains where with AND', async () => {
      const users = await DB.users
        .where({ status: 'active' })
        .where({ name: { contains: 'ob' } })
        .findMany();

      expect(users).toHaveLength(1);
      expect(users[0].name).toBe('Bob');
    });

    it('combines with OR using orWhere', async () => {
      const users = await DB.users
        .where({ status: 'active' })
        .orWhere({ status: 'pending' })
        .findMany();

      expect(users).toHaveLength(3);
    });
  });

  describe('withId', () => {
    it('finds by id', async () => {
      const created = await DB.users.create({ email: uniqueEmail() });

      const user = await DB.users.withId(created.id).findUnique();

      expect(user?.id).toBe(created.id);
    });

    it('composes with other where conditions', async () => {
      const created = await DB.users.create({ email: uniqueEmail(), status: 'active' });

      const user = await DB.users
        .withId(created.id)
        .where({ status: 'active' })
        .findFirst();

      expect(user?.id).toBe(created.id);
    });
  });

  // ==================== ORDER ====================
  describe('ordering', () => {
    beforeEach(async () => {
      await DB.users.createMany([
        { email: 'charlie@test.com', name: 'Charlie' },
        { email: 'alice@test.com', name: 'Alice' },
        { email: 'bob@test.com', name: 'Bob' },
      ]);
    });

    it('orders ascending', async () => {
      const users = await DB.users.order({ name: 'asc' }).findMany();

      expect(users[0].name).toBe('Alice');
      expect(users[1].name).toBe('Bob');
      expect(users[2].name).toBe('Charlie');
    });

    it('orders descending', async () => {
      const users = await DB.users.order({ name: 'desc' }).findMany();

      expect(users[0].name).toBe('Charlie');
    });

    it('first(field) orders by specified field asc', async () => {
      const user = await DB.users.first('id').findFirst();
      // First created (smallest id) should be 'charlie@test.com'
      expect(user?.email).toBe('charlie@test.com');
    });

    it('last(field) orders by specified field desc', async () => {
      const user = await DB.users.last('id').findFirst();
      // Last created (largest id) should be 'bob@test.com'
      expect(user?.email).toBe('bob@test.com');
    });

    it('first(name) orders by name asc', async () => {
      const user = await DB.users.first('name').findFirst();
      expect(user?.name).toBe('Alice');
    });
  });

  // ==================== PAGINATION ====================
  describe('pagination', () => {
    beforeEach(async () => {
      for (let i = 1; i <= 10; i++) {
        await DB.users.create({ email: `user${i}@test.com`, name: `User ${i}` });
      }
    });

    it('limits results', async () => {
      const users = await DB.users.limit(3).findMany();
      expect(users).toHaveLength(3);
    });

    it('skips results', async () => {
      const users = await DB.users.order({ id: 'asc' }).skip(5).findMany();
      expect(users).toHaveLength(5);
    });

    it('combines skip and limit', async () => {
      const users = await DB.users.order({ id: 'asc' }).skip(3).limit(2).findMany();

      expect(users).toHaveLength(2);
    });

    it('paginate() returns paginated result', async () => {
      const result = await DB.users.order({ id: 'asc' }).paginate(2, 3);

      expect(result.data).toHaveLength(3);
      expect(result.meta.total).toBe(10);
      expect(result.meta.currentPage).toBe(2);
      expect(result.meta.perPage).toBe(3);
      expect(result.meta.lastPage).toBe(4);
    });
  });

  // ==================== SELECT ====================
  describe('select', () => {
    it('returns only selected fields', async () => {
      await DB.users.create({ email: 'select@test.com', name: 'Select User', status: 'active' });

      const users = await DB.users.select({ id: true, email: true }).findMany();

      expect(users[0]).toHaveProperty('id');
      expect(users[0]).toHaveProperty('email');
      expect(users[0]).not.toHaveProperty('name');
      expect(users[0]).not.toHaveProperty('status');
    });
  });

  // ==================== DISTINCT ====================
  describe('distinct', () => {
    beforeEach(async () => {
      await DB.users.createMany([
        { email: 'a@test.com', status: 'active' },
        { email: 'b@test.com', status: 'active' },
        { email: 'c@test.com', status: 'pending' },
        { email: 'd@test.com', status: 'active' },
      ]);
    });

    it('returns distinct values', async () => {
      const users = await DB.users
        .distinct(['status'])
        .select({ status: true })
        .findMany();

      const statuses = users.map(u => u.status);
      expect(new Set(statuses).size).toBe(statuses.length);
    });
  });

  // ==================== CONDITIONAL QUERIES ====================
  describe('when (conditional)', () => {
    it('applies condition when true', async () => {
      await DB.users.createMany([
        { email: 'a@test.com', status: 'active' },
        { email: 'b@test.com', status: 'pending' },
      ]);

      const filterActive = true;
      const users = await DB.users
        .when(filterActive, (q) => q.where({ status: 'active' }))
        .findMany();

      expect(users).toHaveLength(1);
    });

    it('skips condition when false', async () => {
      await DB.users.createMany([
        { email: 'a@test.com', status: 'active' },
        { email: 'b@test.com', status: 'pending' },
      ]);

      const filterActive = false;
      const users = await DB.users
        .when(filterActive, (q) => q.where({ status: 'active' }))
        .findMany();

      expect(users).toHaveLength(2);
    });

    it('accepts function as condition', async () => {
      await DB.users.createMany([
        { email: 'a@test.com', status: 'active' },
        { email: 'b@test.com', status: 'pending' },
      ]);

      const users = await DB.users
        .when(() => true, (q) => q.where({ status: 'active' }))
        .findMany();

      expect(users).toHaveLength(1);
    });
  });

  // ==================== WHERE GROUP (Boolean Logic) ====================
  describe('whereGroup / orWhereGroup', () => {
    beforeEach(async () => {
      await DB.users.createMany([
        { email: 'alice@test.com', name: 'Alice', status: 'active' },
        { email: 'bob@test.com', name: 'Bob', status: 'active' },
        { email: 'charlie@test.com', name: 'Charlie', status: 'pending' },
        { email: 'diana@test.com', name: 'Diana', status: 'inactive' },
      ]);
    });

    it('whereGroup creates AND-ed group', async () => {
      // (status = 'active') AND (name starts with 'A' OR name starts with 'B')
      const users = await DB.users
        .where({ status: 'active' })
        .whereGroup((qb) => qb
          .where({ name: { startsWith: 'A' } })
          .orWhere({ name: { startsWith: 'B' } })
        )
        .findMany();

      expect(users).toHaveLength(2);
      expect(users.map(u => u.name).sort()).toEqual(['Alice', 'Bob']);
    });

    it('orWhereGroup creates OR-ed group', async () => {
      // (status = 'active') OR (status = 'pending' AND name = 'Charlie')
      const users = await DB.users
        .where({ status: 'active' })
        .orWhereGroup((qb) => qb
          .where({ status: 'pending' })
          .where({ name: 'Charlie' })
        )
        .findMany();

      expect(users).toHaveLength(3); // Alice, Bob, Charlie
    });

    it('nested whereGroup for complex logic', async () => {
      // (status = 'active' AND name contains 'li') OR (status = 'pending')
      const users = await DB.users
        .whereGroup((qb) => qb
          .where({ status: 'active' })
          .where({ name: { contains: 'li' } })
        )
        .orWhereGroup((qb) => qb
          .where({ status: 'pending' })
        )
        .findMany();

      expect(users).toHaveLength(2); // Alice (active + contains 'li'), Charlie (pending)
    });

    it('whereGroup with OR mode parameter', async () => {
      // (status = 'active') OR (name = 'Charlie')
      const users = await DB.users
        .where({ status: 'active' })
        .whereGroup((qb) => qb.where({ name: 'Charlie' }), 'OR')
        .findMany();

      expect(users).toHaveLength(3); // Alice, Bob, Charlie
    });

    it('empty whereGroup callback is ignored', async () => {
      const users = await DB.users
        .where({ status: 'active' })
        .whereGroup(() => {
          // Empty callback - should not affect query
          return {} as any;
        })
        .findMany();

      expect(users).toHaveLength(2); // Alice, Bob
    });

    it('whereGroup as first condition', async () => {
      // (name starts with 'A' OR name starts with 'B')
      const users = await DB.users
        .whereGroup((qb) => qb
          .where({ name: { startsWith: 'A' } })
          .orWhere({ name: { startsWith: 'B' } })
        )
        .findMany();

      expect(users).toHaveLength(2);
    });
  });

  // ==================== AND WHERE (Explicit) ====================
  describe('andWhere', () => {
    beforeEach(async () => {
      await DB.users.createMany([
        { email: 'alice@test.com', name: 'Alice', status: 'active' },
        { email: 'bob@test.com', name: 'Bob', status: 'active' },
        { email: 'charlie@test.com', name: 'Charlie', status: 'pending' },
      ]);
    });

    it('andWhere is alias for where', async () => {
      const users = await DB.users
        .where({ status: 'active' })
        .andWhere({ name: { startsWith: 'A' } })
        .findMany();

      expect(users).toHaveLength(1);
      expect(users[0].name).toBe('Alice');
    });

    it('chains multiple andWhere calls', async () => {
      const users = await DB.users
        .andWhere({ status: 'active' })
        .andWhere({ name: { not: null } })
        .andWhere({ email: { contains: '@test.com' } })
        .findMany();

      expect(users).toHaveLength(2);
    });
  });

  // ==================== CLONE ====================
  describe('clone', () => {
    beforeEach(async () => {
      await DB.users.createMany([
        { email: 'alice@test.com', name: 'Alice', status: 'active' },
        { email: 'bob@test.com', name: 'Bob', status: 'active' },
        { email: 'charlie@test.com', name: 'Charlie', status: 'pending' },
      ]);
    });

    it('creates independent copy of builder', async () => {
      const baseQuery = DB.users.where({ status: 'active' });
      const cloned = baseQuery.clone();

      // Modify original
      baseQuery.where({ name: 'Alice' });

      // Clone should not be affected
      const results = await cloned.findMany();
      expect(results).toHaveLength(2); // Both active users
    });

    it('cloned query executes independently', async () => {
      const baseQuery = DB.users.where({ status: 'active' });
      const clonedWithExtra = baseQuery.clone().where({ name: 'Bob' });

      const baseResults = await baseQuery.findMany();
      const clonedResults = await clonedWithExtra.findMany();

      expect(baseResults).toHaveLength(2);
      expect(clonedResults).toHaveLength(1);
      expect(clonedResults[0].name).toBe('Bob');
    });

    it('clone preserves complex query state', async () => {
      const baseQuery = DB.users
        .where({ status: 'active' })
        .order({ name: 'asc' })
        .limit(1);

      const cloned = baseQuery.clone();
      const results = await cloned.findMany();

      expect(results).toHaveLength(1);
      expect(results[0].name).toBe('Alice'); // First alphabetically
    });

    it('clone handles Date objects correctly', async () => {
      const date = new Date('2024-01-01');
      const baseQuery = DB.users.where({ createdAt: { gte: date } });
      const cloned = baseQuery.clone();

      // Both should work without affecting each other
      const baseResults = await baseQuery.findMany();
      const clonedResults = await cloned.findMany();

      expect(baseResults.length).toBe(clonedResults.length);
    });
  });

  // ==================== ONLY ====================
  describe('only', () => {
    beforeEach(async () => {
      await DB.users.createMany([
        { email: 'alice@test.com', name: 'Alice', status: 'active' },
        { email: 'bob@test.com', name: 'Bob', status: 'pending' },
      ]);
    });

    it('returns single field value', async () => {
      const email = await DB.users.where({ name: 'Alice' }).only('email');

      expect(email).toBe('alice@test.com');
    });

    it('returns null when no record found', async () => {
      const email = await DB.users.where({ name: 'Nonexistent' }).only('email');

      expect(email).toBeNull();
    });

    it('works with different field types', async () => {
      const name = await DB.users.where({ email: 'alice@test.com' }).only('name');
      const status = await DB.users.where({ email: 'alice@test.com' }).only('status');

      expect(name).toBe('Alice');
      expect(status).toBe('active');
    });

    it('returns first match when multiple records', async () => {
      const status = await DB.users.order({ name: 'asc' }).only('status');

      expect(status).toBe('active'); // Alice's status
    });
  });

  // ==================== PLUCK ====================
  describe('pluck', () => {
    beforeEach(async () => {
      await DB.users.createMany([
        { email: 'charlie@test.com', name: 'Charlie', status: 'pending' },
        { email: 'alice@test.com', name: 'Alice', status: 'active' },
        { email: 'bob@test.com', name: 'Bob', status: 'active' },
      ]);
    });

    it('returns array of single field values', async () => {
      const names = await DB.users.order({ name: 'asc' }).pluck('name');

      expect(names).toEqual(['Alice', 'Bob', 'Charlie']);
    });

    it('returns empty array when no records', async () => {
      const names = await DB.users.where({ status: 'nonexistent' }).pluck('name');

      expect(names).toEqual([]);
    });

    it('plucks email field', async () => {
      const emails = await DB.users.order({ email: 'asc' }).pluck('email');

      expect(emails).toEqual(['alice@test.com', 'bob@test.com', 'charlie@test.com']);
    });

    it('respects where conditions', async () => {
      const names = await DB.users
        .where({ status: 'active' })
        .order({ name: 'asc' })
        .pluck('name');

      expect(names).toEqual(['Alice', 'Bob']);
    });

    it('respects limit', async () => {
      const names = await DB.users.order({ name: 'asc' }).limit(2).pluck('name');

      expect(names).toEqual(['Alice', 'Bob']);
    });
  });

  // ==================== CHUNK ====================
  describe('chunk', () => {
    beforeEach(async () => {
      for (let i = 1; i <= 10; i++) {
        await DB.users.create({
          email: `user${i.toString().padStart(2, '0')}@test.com`,
          name: `User ${i}`,
        });
      }
    });

    it('processes records in chunks', async () => {
      const chunks: number[] = [];

      await DB.users.order({ id: 'asc' }).chunk(3, (records) => {
        chunks.push(records.length);
      });

      expect(chunks).toEqual([3, 3, 3, 1]); // 10 records in chunks of 3
    });

    it('passes correct records to callback', async () => {
      const allNames: string[] = [];

      await DB.users.order({ name: 'asc' }).chunk(5, (records) => {
        allNames.push(...records.map(r => r.name!));
      });

      expect(allNames).toHaveLength(10);
      expect(allNames[0]).toBe('User 1');
      expect(allNames[9]).toBe('User 9'); // 'User 9' comes after 'User 8' alphabetically
    });

    it('works with async callback', async () => {
      let processedCount = 0;

      await DB.users.chunk(4, async (records) => {
        await new Promise(r => setTimeout(r, 10));
        processedCount += records.length;
      });

      expect(processedCount).toBe(10);
    });

    it('respects where conditions', async () => {
      // Update some users to different status using their email (unique field)
      await DB.users.where({ email: 'user01@test.com' }).update({ status: 'inactive' });
      await DB.users.where({ email: 'user02@test.com' }).update({ status: 'inactive' });

      const chunks: number[] = [];

      await DB.users
        .where({ status: 'pending' }) // Default status
        .chunk(3, (records) => {
          chunks.push(records.length);
        });

      expect(chunks.reduce((a, b) => a + b, 0)).toBe(8); // 10 - 2 inactive
    });

    it('handles empty result set', async () => {
      const chunks: number[] = [];

      await DB.users
        .where({ status: 'nonexistent' })
        .chunk(5, (records) => {
          chunks.push(records.length);
        });

      expect(chunks).toEqual([]);
    });

    it('chunk size larger than total records', async () => {
      const chunks: number[] = [];

      await DB.users.chunk(100, (records) => {
        chunks.push(records.length);
      });

      expect(chunks).toEqual([10]); // All 10 in one chunk
    });
  });

  // ==================== GET QUERY ====================
  describe('getQuery', () => {
    it('returns empty object for fresh builder', () => {
      const query = DB.users.getQuery();
      expect(query).toEqual({});
    });

    it('returns where condition', () => {
      const query = DB.users.where({ status: 'active' }).getQuery();
      expect(query.where).toEqual({ status: 'active' });
    });

    it('returns all query parts', () => {
      const query = DB.users
        .where({ status: 'active' })
        .order({ name: 'asc' })
        .limit(10)
        .skip(5)
        .getQuery();

      expect(query.where).toEqual({ status: 'active' });
      expect(query.orderBy).toEqual({ name: 'asc' });
      expect(query.take).toBe(10);
      expect(query.skip).toBe(5);
    });

    it('returns select configuration', () => {
      const query = DB.users.select({ id: true, email: true }).getQuery();
      expect(query.select).toEqual({ id: true, email: true });
    });

    it('returns include configuration', () => {
      const query = DB.users.include('posts').getQuery();
      expect(query.include).toEqual({ posts: true });
    });
  });
});
