/**
 * Deferred Scope Tests
 *
 * Tests for defer(), which queues async work (typically raw SQL) to run right
 * before execution so a scope backed by an await stays synchronously chainable.
 */

import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import {
  DB,
  User,
  cleanDatabase,
  disconnect,
  createUser,
  getPrismaClient,
  uniqueEmail,
} from '#test-helpers';

const prisma = getPrismaClient();

/** Raw SQL returning ids of users whose name contains a needle. */
async function idsByName(needle: string): Promise<number[]> {
  const rows = await prisma.$queryRawUnsafe<{ id: number }[]>(
    `SELECT id FROM "User" WHERE name LIKE '%' || ? || '%'`,
    needle
  );
  return rows.map((r) => r.id);
}

describe('defer()', () => {
  beforeEach(async () => {
    await cleanDatabase();
  });

  afterAll(async () => {
    await disconnect();
  });

  describe('chainability', () => {
    it('stays chainable and applies the deferred where at execution', async () => {
      await createUser({ name: 'Alpha One', email: uniqueEmail(), status: 'active' });
      await createUser({ name: 'Alpha Two', email: uniqueEmail(), status: 'active' });
      await createUser({ name: 'Beta One', email: uniqueEmail(), status: 'active' });

      const users = await DB.users
        .defer(async () => ({ id: { in: await idsByName('Alpha') } }))
        .order({ name: 'asc' })
        .findMany();

      expect(users).toHaveLength(2);
      expect(users.map((u) => u.name)).toEqual(['Alpha One', 'Alpha Two']);
    });

    it('composes with normal scopes regardless of chain order', async () => {
      await createUser({ name: 'Alpha One', email: uniqueEmail(), status: 'active' });
      await createUser({ name: 'Alpha Two', email: uniqueEmail(), status: 'pending' });

      const deferFirst = await DB.users
        .defer(async () => ({ id: { in: await idsByName('Alpha') } }))
        .where({ status: 'active' })
        .findMany();

      const deferLast = await DB.users
        .where({ status: 'active' })
        .defer(async () => ({ id: { in: await idsByName('Alpha') } }))
        .findMany();

      expect(deferFirst).toHaveLength(1);
      expect(deferLast).toHaveLength(1);
      expect(deferFirst[0].id).toBe(deferLast[0].id);
    });

    it('runs multiple deferred callbacks in registration order', async () => {
      await createUser({ name: 'Alpha One', email: uniqueEmail() });
      await createUser({ name: 'Alpha Two', email: uniqueEmail() });
      await createUser({ name: 'Beta One', email: uniqueEmail() });

      const order: string[] = [];
      const users = await DB.users
        .defer(async () => { order.push('first'); return { id: { in: await idsByName('Alpha') } }; })
        .defer(async () => { order.push('second'); return { id: { in: await idsByName('One') } }; })
        .findMany();

      expect(order).toEqual(['first', 'second']);
      expect(users).toHaveLength(1);
      expect(users[0].name).toBe('Alpha One');
    });
  });

  describe('field shorthand', () => {
    beforeEach(async () => {
      await createUser({ name: 'Alpha One', email: uniqueEmail(), status: 'active' });
      await createUser({ name: 'Alpha Two', email: uniqueEmail(), status: 'pending' });
      await createUser({ name: 'Beta One', email: uniqueEmail(), status: 'active' });
    });

    it('plucks the field from row objects and filters by it', async () => {
      const users = await DB.users
        .defer('id', () =>
          prisma.$queryRawUnsafe<{ id: number }[]>(
            `SELECT id FROM "User" WHERE name LIKE '%' || ? || '%'`,
            'Alpha'
          )
        )
        .order({ name: 'asc' })
        .findMany();

      expect(users.map((u) => u.name)).toEqual(['Alpha One', 'Alpha Two']);
    });

    it('accepts bare values instead of row objects', async () => {
      const ids = await idsByName('Alpha');

      const users = await DB.users.defer('id', async () => ids).findMany();

      expect(users).toHaveLength(2);
    });

    it('composes with other scopes and with the filter form', async () => {
      const users = await DB.users
        .defer('id', () =>
          prisma.$queryRawUnsafe<{ id: number }[]>(
            `SELECT id FROM "User" WHERE name LIKE '%' || ? || '%'`,
            'Alpha'
          )
        )
        .where({ status: 'active' })
        .defer(async () => ({ name: { contains: 'One' } }))
        .findMany();

      expect(users).toHaveLength(1);
      expect(users[0].name).toBe('Alpha One');
    });

    it('works on a non-id field', async () => {
      const users = await DB.users
        .defer('name', async () => [{ name: 'Beta One' }])
        .findMany();

      expect(users).toHaveLength(1);
      expect(users[0].name).toBe('Beta One');
    });

    it('yields no rows for an empty result set', async () => {
      expect(await DB.users.defer('id', async () => []).count()).toBe(0);
    });
  });

  describe('terminal coverage', () => {
    beforeEach(async () => {
      await createUser({ name: 'Alpha One', email: uniqueEmail(), status: 'active' });
      await createUser({ name: 'Alpha Two', email: uniqueEmail(), status: 'active' });
      await createUser({ name: 'Beta One', email: uniqueEmail(), status: 'active' });
    });

    const deferAlpha = () =>
      DB.users.defer(async () => ({ id: { in: await idsByName('Alpha') } }));

    it('count() resolves deferred work', async () => {
      expect(await deferAlpha().count()).toBe(2);
    });

    it('findFirst() resolves deferred work', async () => {
      const user = await deferAlpha().order({ name: 'asc' }).findFirst();
      expect(user?.name).toBe('Alpha One');
    });

    it('exists() resolves deferred work', async () => {
      expect(await deferAlpha().exists()).toBe(true);
      const none = await DB.users
        .defer(async () => ({ id: { in: await idsByName('Nobody') } }))
        .exists();
      expect(none).toBe(false);
    });

    it('pluck() resolves deferred work', async () => {
      const names = await deferAlpha().pluck('name');
      expect(names.sort()).toEqual(['Alpha One', 'Alpha Two']);
    });

    it('only() resolves deferred work', async () => {
      const name = await deferAlpha().order({ name: 'asc' }).only('name');
      expect(name).toBe('Alpha One');
    });

    it('paginate() resolves deferred work', async () => {
      const { data, meta } = await deferAlpha().paginate(1, 1);
      expect(data).toHaveLength(1);
      expect(meta.total).toBe(2);
    });

    it('chunk() resolves deferred work', async () => {
      const seen: string[] = [];
      await deferAlpha().chunk(1, async (rows) => {
        for (const r of rows) seen.push(r.name!);
      });
      expect(seen.sort()).toEqual(['Alpha One', 'Alpha Two']);
    });

    it('updateMany() resolves deferred work', async () => {
      const result = await deferAlpha().updateMany({ status: 'archived' });
      expect(result.count).toBe(2);
      expect(await DB.users.where({ status: 'archived' }).count()).toBe(2);
    });

    it('deleteMany() resolves deferred work', async () => {
      const result = await deferAlpha().deleteMany();
      expect(result.count).toBe(2);
      expect(await DB.users.count()).toBe(1);
    });

    it('aggregates resolve deferred work', async () => {
      const total = await DB.users
        .defer(async () => ({ id: { in: await idsByName('Alpha') } }))
        .count();
      expect(total).toBe(2);
    });
  });

  describe('resolution semantics', () => {
    it('runs each resolver once even across repeated terminals', async () => {
      await createUser({ name: 'Alpha One', email: uniqueEmail() });
      await createUser({ name: 'Beta One', email: uniqueEmail() });

      let runs = 0;
      const qb = DB.users.defer(async () => {
        runs++;
        return { id: { in: await idsByName('Alpha') } };
      });

      const first = await qb.count();
      const second = await qb.count();

      expect(runs).toBe(1);
      expect(first).toBe(1);
      expect(second).toBe(1);
    });

    it('resolves once when terminals run concurrently on one builder', async () => {
      await createUser({ name: 'Alpha One', email: uniqueEmail() });
      await createUser({ name: 'Beta One', email: uniqueEmail() });

      let runs = 0;
      const qb = DB.users.defer(async () => {
        runs++;
        return { id: { in: await idsByName('Alpha') } };
      });

      const [a, b] = await Promise.all([qb.count(), qb.count()]);

      expect(runs).toBe(1);
      expect(a).toBe(1);
      expect(b).toBe(1);
    });

    it('propagates errors from a deferred resolver', async () => {
      await expect(
        DB.users
          .defer(async () => {
            throw new Error('raw query failed');
          })
          .findMany()
      ).rejects.toThrow('raw query failed');
    });

    it('is a no-op when no resolver is registered', async () => {
      await createUser({ name: 'Alpha One', email: uniqueEmail() });
      expect(await DB.users.count()).toBe(1);
    });

    it('applies work registered after an earlier execution', async () => {
      await createUser({ name: 'Alpha One', email: uniqueEmail() });
      await createUser({ name: 'Alpha Two', email: uniqueEmail() });
      await createUser({ name: 'Beta One', email: uniqueEmail() });

      const qb = DB.users.defer(async () => {
        return { id: { in: await idsByName('Alpha') } };
      });

      expect(await qb.count()).toBe(2);

      qb.defer(async () => {
        return { id: { in: await idsByName('One') } };
      });

      expect(await qb.count()).toBe(1);
    });

    it('throws instead of deadlocking when a resolver queries its own builder', async () => {
      await createUser({ name: 'Alpha One', email: uniqueEmail() });

      const qb = DB.users;
      qb.defer(async () => {
        await qb.count();
      });

      await expect(qb.count()).rejects.toThrow(/builder it is resolving/);
    });

    it('keeps a failed resolver failing instead of silently retrying', async () => {
      const qb = DB.users.defer(async () => {
        throw new Error('raw query failed');
      });

      await expect(qb.count()).rejects.toThrow('raw query failed');
      await expect(qb.count()).rejects.toThrow('raw query failed');
    });
  });

  describe('clone()', () => {
    it('copies pending deferred work to the clone', async () => {
      await createUser({ name: 'Alpha One', email: uniqueEmail(), status: 'active' });
      await createUser({ name: 'Alpha Two', email: uniqueEmail(), status: 'pending' });
      await createUser({ name: 'Beta One', email: uniqueEmail(), status: 'active' });

      const base = DB.users.defer(async () => ({
        id: { in: await idsByName('Alpha') },
      }));

      const active = await base.clone().where({ status: 'active' }).findMany();
      const pending = await base.clone().where({ status: 'pending' }).findMany();

      expect(active).toHaveLength(1);
      expect(active[0].name).toBe('Alpha One');
      expect(pending).toHaveLength(1);
      expect(pending[0].name).toBe('Alpha Two');
    });

    it('keeps custom model scopes available on the clone', async () => {
      await createUser({ name: 'John Doe', email: uniqueEmail() });
      await createUser({ name: 'Jane Smith', email: uniqueEmail() });

      const cloned = new User().withName('John').clone();

      expect(typeof (cloned as any).withName).toBe('function');
      const users = await cloned.findMany();
      expect(users).toHaveLength(1);
      expect(users[0].name).toBe('John Doe');
    });
  });
});
