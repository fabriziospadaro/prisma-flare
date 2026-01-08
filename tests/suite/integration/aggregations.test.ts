/**
 * Aggregation Tests
 *
 * Tests count, sum, avg, min, max, exists, groupBy.
 */

import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import { DB } from 'prisma-flare/generated';
import { cleanDatabase, disconnect, resetCounter, uniqueEmail, hookRegistry } from '#test-helpers';

describe('Aggregations', () => {
  beforeEach(async () => {
    await cleanDatabase();
    hookRegistry.clearAll();
    resetCounter();
  });

  afterAll(async () => {
    await disconnect();
  });

  // ==================== COUNT ====================
  describe('count', () => {
    it('returns 0 when no records', async () => {
      const count = await DB.users.count();
      expect(count).toBe(0);
    });

    it('returns total count', async () => {
      await DB.users.createMany([
        { email: 'a@test.com' },
        { email: 'b@test.com' },
        { email: 'c@test.com' },
      ]);

      const count = await DB.users.count();
      expect(count).toBe(3);
    });

    it('counts with where condition', async () => {
      await DB.users.createMany([
        { email: 'a@test.com', status: 'active' },
        { email: 'b@test.com', status: 'active' },
        { email: 'c@test.com', status: 'pending' },
      ]);

      const count = await DB.users.where({ status: 'active' }).count();
      expect(count).toBe(2);
    });
  });

  // ==================== EXISTS ====================
  describe('exists', () => {
    it('returns false when no records', async () => {
      const exists = await DB.users.exists();
      expect(exists).toBe(false);
    });

    it('returns true when records exist', async () => {
      await DB.users.create({ email: uniqueEmail() });

      const exists = await DB.users.exists();
      expect(exists).toBe(true);
    });

    it('checks existence with condition', async () => {
      await DB.users.create({ email: uniqueEmail(), status: 'pending' });

      const existsActive = await DB.users.where({ status: 'active' }).exists();
      const existsPending = await DB.users.where({ status: 'pending' }).exists();

      expect(existsActive).toBe(false);
      expect(existsPending).toBe(true);
    });
  });

  // ==================== SUM / AVG / MIN / MAX ====================
  describe('numeric aggregations', () => {
    beforeEach(async () => {
      const user = await DB.users.create({ email: uniqueEmail() });
      await DB.posts.createMany([
        { title: 'Post 1', authorId: user.id, views: 100, likes: 10 },
        { title: 'Post 2', authorId: user.id, views: 200, likes: 20 },
        { title: 'Post 3', authorId: user.id, views: 300, likes: 30 },
      ]);
    });

    it('sum() calculates total', async () => {
      const total = await DB.posts.sum('views');
      expect(total).toBe(600);
    });

    it('avg() calculates average', async () => {
      const average = await DB.posts.avg('views');
      expect(average).toBe(200);
    });

    it('min() finds minimum', async () => {
      const min = await DB.posts.min('views');
      expect(min).toBe(100);
    });

    it('max() finds maximum', async () => {
      const max = await DB.posts.max('views');
      expect(max).toBe(300);
    });

    it('aggregates with where condition', async () => {
      const sum = await DB.posts.where({ views: { gte: 200 } }).sum('views');
      expect(sum).toBe(500); // 200 + 300
    });
  });

  // ==================== COMBINED AGGREGATIONS ====================
  describe('combined operations', () => {
    it('filters, then aggregates', async () => {
      const user = await DB.users.create({ email: uniqueEmail() });
      await DB.posts.createMany([
        { title: 'Published 1', authorId: user.id, views: 100, published: true },
        { title: 'Published 2', authorId: user.id, views: 200, published: true },
        { title: 'Draft', authorId: user.id, views: 50, published: false },
      ]);

      const publishedViews = await DB.posts
        .where({ published: true })
        .sum('views');

      expect(publishedViews).toBe(300);
    });

    it('counts with complex conditions', async () => {
      await DB.users.createMany([
        { email: 'a@test.com', name: 'Alice', status: 'active' },
        { email: 'b@test.com', name: 'Bob', status: 'active' },
        { email: 'c@test.com', name: 'Charlie', status: 'pending' },
      ]);

      const count = await DB.users
        .where({ status: 'active' })
        .where({ name: { startsWith: 'A' } })
        .count();

      expect(count).toBe(1);
    });
  });

  // ==================== GROUPBY ====================
  describe('groupBy', () => {
    beforeEach(async () => {
      await DB.users.createMany([
        { email: 'a@test.com', name: 'Alice', status: 'active' },
        { email: 'b@test.com', name: 'Bob', status: 'active' },
        { email: 'c@test.com', name: 'Charlie', status: 'pending' },
        { email: 'd@test.com', name: 'Diana', status: 'pending' },
        { email: 'e@test.com', name: 'Eve', status: 'inactive' },
      ]);
    });

    it('sets groupBy field in query', () => {
      const query = DB.users.groupBy(['status']).getQuery();
      expect((query as any).by).toEqual(['status']);
    });

    it('groupBy with multiple fields', () => {
      const query = DB.users.groupBy(['status', 'name']).getQuery();
      expect((query as any).by).toEqual(['status', 'name']);
    });
  });

  // ==================== HAVING ====================
  describe('having', () => {
    it('sets having condition in query', () => {
      const query = DB.users
        .groupBy(['status'])
        .having({ status: { _count: { gt: 1 } } })
        .getQuery();

      expect(query.having).toEqual({ status: { _count: { gt: 1 } } });
    });

    it('combines with groupBy', () => {
      const query = DB.users
        .groupBy(['status'])
        .having({ status: { not: '' } })
        .getQuery();

      expect((query as any).by).toEqual(['status']);
      expect(query.having).toEqual({ status: { not: '' } });
    });
  });
});
