/**
 * Where Clause Composition Integration Tests
 *
 * Comprehensive tests for query composition and boolean logic:
 * - AND composition
 * - OR composition
 * - whereGroup / orWhereGroup
 * - NOT conditions
 * - Nested conditions
 * - Complex boolean expressions
 */

import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import { DB } from 'prisma-flare/generated';
import { cleanDatabase, disconnectPrisma } from '../../helpers/database.js';

describe('Where Clause Composition', () => {
  beforeEach(async () => {
    await cleanDatabase();

    // Setup consistent test data
    await DB.users.createMany([
      { email: 'alice-active@test.com', name: 'Alice', status: 'active' },
      { email: 'alice-pending@test.com', name: 'Alice', status: 'pending' },
      { email: 'bob-active@test.com', name: 'Bob', status: 'active' },
      { email: 'bob-pending@test.com', name: 'Bob', status: 'pending' },
      { email: 'charlie-active@test.com', name: 'Charlie', status: 'active' },
      { email: 'charlie-banned@test.com', name: 'Charlie', status: 'banned' },
    ]);
  });

  afterAll(async () => {
    await disconnectPrisma();
  });

  /**
   * ============================================
   * AND COMPOSITION
   * ============================================
   */
  describe('AND Composition', () => {
    it('should compose multiple where() with AND', async () => {
      const users = await DB.users
        .where({ name: 'Alice' })
        .where({ status: 'active' })
        .findMany();

      expect(users).toHaveLength(1);
      expect(users[0].email).toBe('alice-active@test.com');
    });

    it('should use andWhere() as explicit alias', async () => {
      const users = await DB.users
        .where({ name: 'Alice' })
        .andWhere({ status: 'active' })
        .findMany();

      expect(users).toHaveLength(1);
      expect(users[0].email).toBe('alice-active@test.com');
    });

    it('should handle three+ AND conditions', async () => {
      const users = await DB.users
        .where({ name: 'Alice' })
        .where({ status: 'active' })
        .where({ email: { contains: 'active' } })
        .findMany();

      expect(users).toHaveLength(1);
    });

    it('should not silently overwrite conditions on same field', async () => {
      // Both conditions must be satisfied
      const users = await DB.users
        .where({ name: { contains: 'li' } }) // Alice, Charlie
        .where({ name: { startsWith: 'A' } }) // Alice
        .findMany();

      expect(users).toHaveLength(2); // Both Alice entries
      expect(users.every((u) => u.name === 'Alice')).toBe(true);
    });
  });

  /**
   * ============================================
   * OR COMPOSITION
   * ============================================
   */
  describe('OR Composition', () => {
    it('should compose with OR using orWhere()', async () => {
      const users = await DB.users
        .where({ name: 'Alice' })
        .orWhere({ name: 'Bob' })
        .order({ email: 'asc' })
        .findMany();

      expect(users).toHaveLength(4);
      expect(users.every((u) => u.name === 'Alice' || u.name === 'Bob')).toBe(true);
    });

    it('should handle status OR with orWhere()', async () => {
      const users = await DB.users
        .where({ status: 'active' })
        .orWhere({ status: 'banned' })
        .findMany();

      expect(users).toHaveLength(4); // 3 active + 1 banned
    });

    it('should build (A AND B) OR C correctly', async () => {
      // (name = 'Alice' AND status = 'active') OR (name = 'Charlie')
      const users = await DB.users
        .where({ name: 'Alice' })
        .where({ status: 'active' })
        .orWhere({ name: 'Charlie' })
        .order({ email: 'asc' })
        .findMany();

      expect(users).toHaveLength(3); // alice-active + both charlies
    });

    it('should build (A OR B) AND C correctly', async () => {
      const users = await DB.users
        .where({ status: 'active' })
        .orWhere({ status: 'pending' })
        .where({ name: 'Alice' })
        .findMany();

      // (active OR pending) AND Alice = both Alice users
      expect(users).toHaveLength(2);
      expect(users.every((u) => u.name === 'Alice')).toBe(true);
    });
  });

  /**
   * ============================================
   * WHERE GROUPS
   * ============================================
   */
  describe('Where Groups', () => {
    describe('whereGroup (AND combined)', () => {
      it('should build A AND (B OR C)', async () => {
        // status = 'active' AND (name = 'Alice' OR name = 'Bob')
        const users = await DB.users
          .where({ status: 'active' })
          .whereGroup((qb) => qb.where({ name: 'Alice' }).orWhere({ name: 'Bob' }))
          .order({ email: 'asc' })
          .findMany();

        expect(users).toHaveLength(2);
        expect(users.map((u) => u.email)).toEqual([
          'alice-active@test.com',
          'bob-active@test.com',
        ]);
      });

      it('should handle nested groups', async () => {
        // status = 'active' AND (name = 'Alice' OR (name = 'Charlie' AND email contains 'active'))
        const users = await DB.users
          .where({ status: 'active' })
          .whereGroup((qb) =>
            qb
              .where({ name: 'Alice' })
              .orWhereGroup((inner) =>
                inner
                  .where({ name: 'Charlie' })
                  .where({ email: { contains: 'active' } })
              )
          )
          .findMany();

        expect(users).toHaveLength(2); // alice-active + charlie-active
      });
    });

    describe('orWhereGroup (OR combined)', () => {
      it('should build A OR (B AND C)', async () => {
        // status = 'active' OR (name = 'Charlie' AND status = 'banned')
        const users = await DB.users
          .where({ status: 'active' })
          .orWhereGroup((qb) =>
            qb.where({ name: 'Charlie' }).where({ status: 'banned' })
          )
          .findMany();

        expect(users).toHaveLength(4); // 3 active + charlie-banned
      });

      it('should handle multiple groups', async () => {
        // (name = 'Alice' AND status = 'active') OR (name = 'Bob' AND status = 'pending')
        const users = await DB.users
          .whereGroup((qb) =>
            qb.where({ name: 'Alice' }).where({ status: 'active' })
          )
          .orWhereGroup((qb) =>
            qb.where({ name: 'Bob' }).where({ status: 'pending' })
          )
          .findMany();

        expect(users).toHaveLength(2);
        expect(users.map((u) => u.email).sort()).toEqual([
          'alice-active@test.com',
          'bob-pending@test.com',
        ]);
      });
    });
  });

  /**
   * ============================================
   * NOT CONDITIONS
   * ============================================
   */
  describe('NOT Conditions', () => {
    it('should exclude with NOT in where()', async () => {
      const users = await DB.users
        .where({ NOT: { status: 'banned' } })
        .findMany();

      expect(users).toHaveLength(5);
      expect(users.every((u) => u.status !== 'banned')).toBe(true);
    });

    it('should combine NOT with AND', async () => {
      const users = await DB.users
        .where({ status: 'active' })
        .where({ NOT: { name: 'Charlie' } })
        .findMany();

      expect(users).toHaveLength(2);
      expect(users.map((u) => u.name).sort()).toEqual(['Alice', 'Bob']);
    });

    it('should handle NOT with complex condition', async () => {
      const users = await DB.users
        .where({ NOT: { name: { in: ['Alice', 'Bob'] } } })
        .findMany();

      expect(users).toHaveLength(2);
      expect(users.every((u) => u.name === 'Charlie')).toBe(true);
    });

    it('should combine multiple NOTs', async () => {
      const users = await DB.users
        .where({ NOT: { status: 'banned' } })
        .where({ NOT: { status: 'pending' } })
        .findMany();

      expect(users).toHaveLength(3);
      expect(users.every((u) => u.status === 'active')).toBe(true);
    });
  });

  /**
   * ============================================
   * COMPLEX BOOLEAN EXPRESSIONS
   * ============================================
   */
  describe('Complex Boolean Expressions', () => {
    it('should handle real-world search scenario', async () => {
      // Active users named starting with A or B, but not pending
      const users = await DB.users
        .where({ status: 'active' })
        .whereGroup((qb) =>
          qb
            .where({ name: { startsWith: 'A' } })
            .orWhere({ name: { startsWith: 'B' } })
        )
        .where({ NOT: { status: 'pending' } })
        .order({ name: 'asc' })
        .findMany();

      expect(users).toHaveLength(2);
      expect(users.map((u) => u.name)).toEqual(['Alice', 'Bob']);
    });

    it('should handle filter by multiple names', async () => {
      const targetNames = ['Alice', 'Charlie'];

      const users = await DB.users
        .where({ name: { in: targetNames } })
        .where({ status: 'active' })
        .findMany();

      expect(users).toHaveLength(2);
    });

    it('should handle exclusion of multiple statuses', async () => {
      const users = await DB.users
        .where({ status: { notIn: ['pending', 'banned'] } })
        .findMany();

      expect(users).toHaveLength(3);
      expect(users.every((u) => u.status === 'active')).toBe(true);
    });

    it('should handle email pattern with status filter', async () => {
      const users = await DB.users
        .where({ email: { contains: 'active' } })
        .where({ name: { not: 'Charlie' } })
        .findMany();

      expect(users).toHaveLength(2);
    });
  });

  /**
   * ============================================
   * COMMON MISUSE PATTERNS
   * ============================================
   */
  describe('Common Misuse Patterns (Teaching Tests)', () => {
    it('[TEACHING] orWhere after multiple where produces unexpected results', async () => {
      // User intends: active users named Alice or Bob
      // But gets: (active AND Alice) OR Bob

      const wrongResult = await DB.users
        .where({ status: 'active' })
        .where({ name: 'Alice' })
        .orWhere({ name: 'Bob' }) // Wraps ALL previous as OR
        .order({ email: 'asc' })
        .findMany();

      // This includes Bob regardless of status!
      expect(wrongResult.find((u) => u.email === 'bob-pending@test.com')).toBeDefined();

      // CORRECT approach using whereGroup
      const correctResult = await DB.users
        .where({ status: 'active' })
        .whereGroup((qb) => qb.where({ name: 'Alice' }).orWhere({ name: 'Bob' }))
        .order({ email: 'asc' })
        .findMany();

      expect(correctResult).toHaveLength(2);
      expect(correctResult.every((u) => u.status === 'active')).toBe(true);
    });

    it('[TEACHING] proper way to express "active AND (Alice OR Bob)"', async () => {
      const users = await DB.users
        .where({ status: 'active' })
        .whereGroup((qb) => qb.where({ name: 'Alice' }).orWhere({ name: 'Bob' }))
        .findMany();

      expect(users).toHaveLength(2);
      expect(users.every((u) => u.status === 'active')).toBe(true);
      expect(users.every((u) => ['Alice', 'Bob'].includes(u.name!))).toBe(true);
    });
  });

  /**
   * ============================================
   * EDGE CASES
   * ============================================
   */
  describe('Edge Cases', () => {
    it('should handle empty where()', async () => {
      const users = await DB.users.where({}).findMany();
      expect(users).toHaveLength(6);
    });

    it('should handle empty whereGroup', async () => {
      const users = await DB.users
        .where({ status: 'active' })
        .whereGroup(() => DB.users) // Empty group
        .findMany();

      expect(users).toHaveLength(3); // Just active users
    });

    it('should handle single where with OR inside', async () => {
      const users = await DB.users
        .where({
          OR: [{ name: 'Alice' }, { name: 'Bob' }],
        })
        .findMany();

      expect(users).toHaveLength(4);
    });

    it('should handle single where with AND inside', async () => {
      const users = await DB.users
        .where({
          AND: [{ name: 'Alice' }, { status: 'active' }],
        })
        .findMany();

      expect(users).toHaveLength(1);
    });

    it('should handle deeply nested native Prisma syntax', async () => {
      const users = await DB.users
        .where({
          AND: [
            { status: 'active' },
            {
              OR: [{ name: 'Alice' }, { name: 'Bob' }],
            },
          ],
        })
        .findMany();

      expect(users).toHaveLength(2);
    });
  });

  /**
   * ============================================
   * WITH ID COMPOSITION
   * ============================================
   */
  describe('withId() Composition', () => {
    it('should compose withId with where', async () => {
      const alice = await DB.users.where({ email: 'alice-active@test.com' }).findFirst();

      const user = await DB.users
        .where({ status: 'active' })
        .withId(alice!.id)
        .findFirst();

      expect(user?.id).toBe(alice!.id);
    });

    it('should compose where with withId', async () => {
      const alice = await DB.users.where({ email: 'alice-active@test.com' }).findFirst();

      const user = await DB.users
        .withId(alice!.id)
        .where({ status: 'active' })
        .findFirst();

      expect(user?.id).toBe(alice!.id);
    });

    it('should return null when withId and where conflict', async () => {
      const alice = await DB.users.where({ email: 'alice-active@test.com' }).findFirst();

      // Alice is active, but we're looking for pending
      const user = await DB.users
        .withId(alice!.id)
        .where({ status: 'pending' })
        .findFirst();

      expect(user).toBeNull();
    });
  });
});
