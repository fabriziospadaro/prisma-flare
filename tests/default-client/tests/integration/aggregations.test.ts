/**
 * Aggregation Operations Integration Tests
 *
 * Comprehensive tests for all aggregation operations:
 * - count()
 * - sum()
 * - avg()
 * - min()
 * - max()
 * - paginate()
 * - chunk()
 */

import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import { DB } from 'prisma-flare/generated';
import { cleanDatabase, disconnectPrisma } from '../helpers/database.js';
import {
  createUser,
  createUsers,
  createPost,
  createPosts,
  createAggregationDataset,
  createPaginationDataset,
} from '../helpers/factories.js';
import { assertPaginationMeta } from '../helpers/assertions.js';

describe('Aggregation Operations', () => {
  beforeEach(async () => {
    await cleanDatabase();
  });

  afterAll(async () => {
    await disconnectPrisma();
  });

  /**
   * ============================================
   * COUNT
   * ============================================
   */
  describe('count()', () => {
    it('should return 0 for empty table', async () => {
      const count = await DB.users.count();
      expect(count).toBe(0);
    });

    it('should count all records', async () => {
      await createUsers(10);
      const count = await DB.users.count();
      expect(count).toBe(10);
    });

    it('should count with where condition', async () => {
      await DB.users.createMany([
        { email: 'a@test.com', status: 'active' },
        { email: 'b@test.com', status: 'active' },
        { email: 'c@test.com', status: 'pending' },
        { email: 'd@test.com', status: 'banned' },
      ]);

      const activeCount = await DB.users.where({ status: 'active' }).count();
      expect(activeCount).toBe(2);
    });

    it('should count with complex conditions', async () => {
      await DB.users.createMany([
        { email: 'alice@test.com', name: 'Alice', status: 'active' },
        { email: 'bob@test.com', name: 'Bob', status: 'active' },
        { email: 'alice2@test.com', name: 'Alice', status: 'pending' },
      ]);

      const count = await DB.users
        .where({ status: 'active' })
        .where({ name: { startsWith: 'A' } })
        .count();

      expect(count).toBe(1);
    });

    it('should return 0 when no matches', async () => {
      await createUsers(5);
      const count = await DB.users.where({ status: 'nonexistent' }).count();
      expect(count).toBe(0);
    });
  });

  /**
   * ============================================
   * SUM
   * ============================================
   */
  describe('sum()', () => {
    it('should sum numeric field', async () => {
      const user = await createUser();
      await DB.posts.createMany([
        { title: 'P1', authorId: user.id, views: 100 },
        { title: 'P2', authorId: user.id, views: 200 },
        { title: 'P3', authorId: user.id, views: 300 },
      ]);

      const total = await DB.posts.sum('views');
      expect(total).toBe(600);
    });

    it('should sum with where condition', async () => {
      const user = await createUser();
      await DB.posts.createMany([
        { title: 'P1', authorId: user.id, views: 100, published: true },
        { title: 'P2', authorId: user.id, views: 200, published: true },
        { title: 'P3', authorId: user.id, views: 300, published: false },
      ]);

      const total = await DB.posts.where({ published: true }).sum('views');
      expect(total).toBe(300);
    });

    it('should return null for empty result', async () => {
      const total = await DB.posts.sum('views');
      expect(total).toBeNull();
    });

    it('should return null when no matches', async () => {
      const user = await createUser();
      await createPost({ authorId: user.id, views: 100 });

      const total = await DB.posts.where({ views: 999 }).sum('views');
      expect(total).toBeNull();
    });

    it('should sum zero values correctly', async () => {
      const user = await createUser();
      await DB.posts.createMany([
        { title: 'P1', authorId: user.id, views: 0 },
        { title: 'P2', authorId: user.id, views: 0 },
      ]);

      const total = await DB.posts.sum('views');
      expect(total).toBe(0);
    });
  });

  /**
   * ============================================
   * AVG
   * ============================================
   */
  describe('avg()', () => {
    it('should calculate average of numeric field', async () => {
      const user = await createUser();
      await DB.posts.createMany([
        { title: 'P1', authorId: user.id, views: 100 },
        { title: 'P2', authorId: user.id, views: 200 },
        { title: 'P3', authorId: user.id, views: 300 },
      ]);

      const average = await DB.posts.avg('views');
      expect(average).toBe(200);
    });

    it('should calculate average with where condition', async () => {
      const user = await createUser();
      await DB.posts.createMany([
        { title: 'P1', authorId: user.id, views: 100, published: true },
        { title: 'P2', authorId: user.id, views: 200, published: true },
        { title: 'P3', authorId: user.id, views: 600, published: false },
      ]);

      const average = await DB.posts.where({ published: true }).avg('views');
      expect(average).toBe(150);
    });

    it('should return null for empty result', async () => {
      const average = await DB.posts.avg('views');
      expect(average).toBeNull();
    });

    it('should handle single record', async () => {
      const user = await createUser();
      await createPost({ authorId: user.id, views: 50 });

      const average = await DB.posts.avg('views');
      expect(average).toBe(50);
    });
  });

  /**
   * ============================================
   * MIN
   * ============================================
   */
  describe('min()', () => {
    it('should find minimum numeric value', async () => {
      const user = await createUser();
      await DB.posts.createMany([
        { title: 'P1', authorId: user.id, views: 100 },
        { title: 'P2', authorId: user.id, views: 50 },
        { title: 'P3', authorId: user.id, views: 200 },
      ]);

      const minimum = await DB.posts.min('views');
      expect(minimum).toBe(50);
    });

    it('should find minimum with where condition', async () => {
      const user = await createUser();
      await DB.posts.createMany([
        { title: 'P1', authorId: user.id, views: 10, published: true },
        { title: 'P2', authorId: user.id, views: 50, published: true },
        { title: 'P3', authorId: user.id, views: 5, published: false },
      ]);

      const minimum = await DB.posts.where({ published: true }).min('views');
      expect(minimum).toBe(10);
    });

    it('should return null for empty result', async () => {
      const minimum = await DB.posts.min('views');
      expect(minimum).toBeNull();
    });

    it('should find minimum date', async () => {
      const user = await createUser();
      const dates = [
        new Date('2024-01-15'),
        new Date('2024-01-10'),
        new Date('2024-01-20'),
      ];

      for (const date of dates) {
        await DB.posts.create({
          title: 'Post',
          authorId: user.id,
          createdAt: date,
        });
      }

      const minimum = await DB.posts.min('createdAt');
      expect(new Date(minimum).getTime()).toBe(dates[1].getTime());
    });
  });

  /**
   * ============================================
   * MAX
   * ============================================
   */
  describe('max()', () => {
    it('should find maximum numeric value', async () => {
      const user = await createUser();
      await DB.posts.createMany([
        { title: 'P1', authorId: user.id, views: 100 },
        { title: 'P2', authorId: user.id, views: 500 },
        { title: 'P3', authorId: user.id, views: 200 },
      ]);

      const maximum = await DB.posts.max('views');
      expect(maximum).toBe(500);
    });

    it('should find maximum with where condition', async () => {
      const user = await createUser();
      await DB.posts.createMany([
        { title: 'P1', authorId: user.id, views: 100, published: true },
        { title: 'P2', authorId: user.id, views: 50, published: true },
        { title: 'P3', authorId: user.id, views: 500, published: false },
      ]);

      const maximum = await DB.posts.where({ published: true }).max('views');
      expect(maximum).toBe(100);
    });

    it('should return null for empty result', async () => {
      const maximum = await DB.posts.max('views');
      expect(maximum).toBeNull();
    });

    it('should find maximum date', async () => {
      const user = await createUser();
      const dates = [
        new Date('2024-01-15'),
        new Date('2024-01-10'),
        new Date('2024-01-20'),
      ];

      for (const date of dates) {
        await DB.posts.create({
          title: 'Post',
          authorId: user.id,
          createdAt: date,
        });
      }

      const maximum = await DB.posts.max('createdAt');
      expect(new Date(maximum).getTime()).toBe(dates[2].getTime());
    });
  });

  /**
   * ============================================
   * PAGINATE
   * ============================================
   */
  describe('paginate()', () => {
    describe('Basic Pagination', () => {
      it('should paginate results', async () => {
        await createUsers(25);

        const page1 = await DB.users.order({ id: 'asc' }).paginate(1, 10);

        expect(page1.data).toHaveLength(10);
        assertPaginationMeta(page1.meta, {
          total: 25,
          currentPage: 1,
          perPage: 10,
        });
      });

      it('should return correct page', async () => {
        await createUsers(30);

        const page2 = await DB.users.order({ id: 'asc' }).paginate(2, 10);

        expect(page2.data).toHaveLength(10);
        expect(page2.meta.currentPage).toBe(2);
        expect(page2.meta.prev).toBe(1);
        expect(page2.meta.next).toBe(3);
      });

      it('should handle last page with fewer items', async () => {
        await createUsers(25);

        const lastPage = await DB.users.order({ id: 'asc' }).paginate(3, 10);

        expect(lastPage.data).toHaveLength(5);
        expect(lastPage.meta.next).toBeNull();
      });

      it('should return empty data for page beyond total', async () => {
        await createUsers(10);

        const emptyPage = await DB.users.paginate(5, 10);

        expect(emptyPage.data).toHaveLength(0);
      });

      it('should use default values', async () => {
        await createUsers(20);

        const defaultPage = await DB.users.paginate();

        expect(defaultPage.meta.currentPage).toBe(1);
        expect(defaultPage.meta.perPage).toBe(15);
      });
    });

    describe('Pagination with Filters', () => {
      it('should paginate filtered results', async () => {
        await DB.users.createMany([
          ...Array.from({ length: 20 }, (_, i) => ({
            email: `active-${i}@test.com`,
            status: 'active',
          })),
          ...Array.from({ length: 10 }, (_, i) => ({
            email: `pending-${i}@test.com`,
            status: 'pending',
          })),
        ]);

        const activePage = await DB.users
          .where({ status: 'active' })
          .paginate(1, 10);

        expect(activePage.meta.total).toBe(20);
        expect(activePage.data).toHaveLength(10);
        expect(activePage.data.every((u) => u.status === 'active')).toBe(true);
      });

      it('should maintain filter across pages', async () => {
        await DB.users.createMany(
          Array.from({ length: 30 }, (_, i) => ({
            email: `user-${i}@test.com`,
            status: i % 2 === 0 ? 'active' : 'pending',
          }))
        );

        const page1 = await DB.users.where({ status: 'active' }).paginate(1, 5);
        const page2 = await DB.users.where({ status: 'active' }).paginate(2, 5);

        expect(page1.data.every((u) => u.status === 'active')).toBe(true);
        expect(page2.data.every((u) => u.status === 'active')).toBe(true);
      });
    });

    describe('Pagination Metadata', () => {
      it('should calculate lastPage correctly', async () => {
        await createUsers(23);

        const page = await DB.users.paginate(1, 5);

        expect(page.meta.lastPage).toBe(5); // ceil(23/5) = 5
      });

      it('should set prev/next correctly for first page', async () => {
        await createUsers(30);

        const firstPage = await DB.users.paginate(1, 10);

        expect(firstPage.meta.prev).toBeNull();
        expect(firstPage.meta.next).toBe(2);
      });

      it('should set prev/next correctly for last page', async () => {
        await createUsers(30);

        const lastPage = await DB.users.paginate(3, 10);

        expect(lastPage.meta.prev).toBe(2);
        expect(lastPage.meta.next).toBeNull();
      });

      it('should set prev/next correctly for middle page', async () => {
        await createUsers(50);

        const middlePage = await DB.users.paginate(3, 10);

        expect(middlePage.meta.prev).toBe(2);
        expect(middlePage.meta.next).toBe(4);
      });
    });
  });

  /**
   * ============================================
   * CHUNK
   * ============================================
   */
  describe('chunk()', () => {
    it('should process records in chunks', async () => {
      await createUsers(25);

      const chunks: number[] = [];

      await DB.users.chunk(10, (users) => {
        chunks.push(users.length);
      });

      expect(chunks).toEqual([10, 10, 5]);
    });

    it('should pass correct data to callback', async () => {
      await DB.users.createMany([
        { email: 'a@test.com', name: 'Alice' },
        { email: 'b@test.com', name: 'Bob' },
        { email: 'c@test.com', name: 'Charlie' },
      ]);

      const allNames: string[] = [];

      await DB.users.order({ name: 'asc' }).chunk(2, (users) => {
        allNames.push(...users.map((u) => u.name!));
      });

      expect(allNames).toEqual(['Alice', 'Bob', 'Charlie']);
    });

    it('should handle empty table', async () => {
      let callCount = 0;

      await DB.users.chunk(10, () => {
        callCount++;
      });

      expect(callCount).toBe(0);
    });

    it('should handle chunk size larger than total', async () => {
      await createUsers(5);

      const chunks: number[] = [];

      await DB.users.chunk(100, (users) => {
        chunks.push(users.length);
      });

      expect(chunks).toEqual([5]);
    });

    it('should respect where condition', async () => {
      await DB.users.createMany([
        { email: 'a@test.com', status: 'active' },
        { email: 'b@test.com', status: 'active' },
        { email: 'c@test.com', status: 'pending' },
        { email: 'd@test.com', status: 'active' },
      ]);

      let totalProcessed = 0;

      await DB.users.where({ status: 'active' }).chunk(2, (users) => {
        totalProcessed += users.length;
        expect(users.every((u) => u.status === 'active')).toBe(true);
      });

      expect(totalProcessed).toBe(3);
    });

    it('should support async callback', async () => {
      await createUsers(10);

      const processedIds: number[] = [];

      await DB.users.chunk(3, async (users) => {
        await new Promise((resolve) => setTimeout(resolve, 10));
        processedIds.push(...users.map((u) => u.id));
      });

      expect(processedIds).toHaveLength(10);
    });
  });

  /**
   * ============================================
   * COMBINED AGGREGATIONS
   * ============================================
   */
  describe('Combined Aggregations', () => {
    it('should run multiple aggregations on same data', async () => {
      const { posts } = await createAggregationDataset();

      const [count, total, average, minimum, maximum] = await Promise.all([
        DB.posts.count(),
        DB.posts.sum('views'),
        DB.posts.avg('views'),
        DB.posts.min('views'),
        DB.posts.max('views'),
      ]);

      expect(count).toBe(9); // 3 users * 3 posts each
      expect(total).toBe(100 + 200 + 50 + 100 + 200 + 50 + 100 + 200 + 50); // 1050
      expect(average).toBeCloseTo(1050 / 9);
      expect(minimum).toBe(50);
      expect(maximum).toBe(200);
    });

    it('should aggregate with complex filters', async () => {
      await createAggregationDataset();

      // Only published posts
      const publishedCount = await DB.posts.where({ published: true }).count();
      const publishedTotal = await DB.posts.where({ published: true }).sum('views');
      const publishedAvg = await DB.posts.where({ published: true }).avg('views');

      expect(publishedCount).toBe(6); // 2 published per user * 3 users
      expect(publishedTotal).toBe((100 + 200) * 3); // 900
      expect(publishedAvg).toBe(150);
    });
  });
});
