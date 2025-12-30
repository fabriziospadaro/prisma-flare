/**
 * Type Safety Tests
 *
 * Compile-time type checks using expect-type.
 * These tests verify that generated types are correct across all Prisma configurations.
 */

import { describe, it, expectTypeOf } from 'vitest';
import { DB } from 'prisma-flare/generated';
import {
  beforeCreate,
  afterCreate,
  beforeUpdate,
  afterUpdate,
  beforeDelete,
  afterDelete,
  afterChange,
} from 'prisma-flare';

// ==================== MODEL TYPES ====================
interface ExpectedUser {
  id: number;
  email: string;
  name: string | null;
  status: string;
  createdAt: Date;
  updatedAt: Date;
}

interface ExpectedPost {
  id: number;
  title: string;
  content: string | null;
  published: boolean;
  views: number;
  likes: number;
  authorId: number;
  createdAt: Date;
  updatedAt: Date;
}

describe('Type Safety', () => {
  // ==================== DB STATIC PROPERTIES ====================
  describe('DB Static Access', () => {
    it('DB has model properties', () => {
      expectTypeOf(DB.users).toBeObject();
      expectTypeOf(DB.posts).toBeObject();
    });

    it('DB.instance exists', () => {
      expectTypeOf(DB.instance).toBeObject();
    });

    it('DB.instance.from returns builder', () => {
      const builder = DB.instance.from('user');
      expectTypeOf(builder.findMany).toBeFunction();
    });
  });

  // ==================== FLARE BUILDER - QUERY METHODS ====================
  describe('FlareBuilder Query Methods', () => {
    describe('where()', () => {
      it('accepts valid where conditions', () => {
        const builder = DB.users.where({ email: 'test@test.com' });
        expectTypeOf(builder.findMany).toBeFunction();
      });

      it('supports equals filter', () => {
        const builder = DB.users.where({ status: { equals: 'active' } });
        expectTypeOf(builder.findMany).toBeFunction();
      });

      it('supports contains filter', () => {
        const builder = DB.users.where({ email: { contains: '@gmail' } });
        expectTypeOf(builder.findMany).toBeFunction();
      });

      it('supports startsWith filter', () => {
        const builder = DB.users.where({ email: { startsWith: 'test' } });
        expectTypeOf(builder.findMany).toBeFunction();
      });

      it('supports endsWith filter', () => {
        const builder = DB.users.where({ email: { endsWith: '.com' } });
        expectTypeOf(builder.findMany).toBeFunction();
      });

      it('supports in filter', () => {
        const builder = DB.users.where({ status: { in: ['active', 'pending'] } });
        expectTypeOf(builder.findMany).toBeFunction();
      });

      it('supports notIn filter', () => {
        const builder = DB.users.where({ status: { notIn: ['deleted'] } });
        expectTypeOf(builder.findMany).toBeFunction();
      });

      it('supports not filter', () => {
        const builder = DB.users.where({ status: { not: 'deleted' } });
        expectTypeOf(builder.findMany).toBeFunction();
      });

      it('supports gt/gte/lt/lte filters', () => {
        const builder = DB.posts.where({ views: { gt: 100, lte: 1000 } });
        expectTypeOf(builder.findMany).toBeFunction();
      });

      it('supports AND composition', () => {
        const builder = DB.users.where({ AND: [{ status: 'active' }, { name: { not: null } }] });
        expectTypeOf(builder.findMany).toBeFunction();
      });

      it('supports OR composition', () => {
        const builder = DB.users.where({ OR: [{ status: 'active' }, { status: 'pending' }] });
        expectTypeOf(builder.findMany).toBeFunction();
      });

      it('supports NOT composition', () => {
        const builder = DB.users.where({ NOT: { status: 'deleted' } });
        expectTypeOf(builder.findMany).toBeFunction();
      });
    });

    describe('andWhere() / orWhere()', () => {
      it('andWhere maintains builder type', () => {
        const builder = DB.users.where({ status: 'active' }).andWhere({ name: { not: null } });
        expectTypeOf(builder.findMany).toBeFunction();
      });

      it('orWhere maintains builder type', () => {
        const builder = DB.users.where({ status: 'active' }).orWhere({ status: 'pending' });
        expectTypeOf(builder.findMany).toBeFunction();
      });
    });

    describe('whereGroup() / orWhereGroup()', () => {
      it('whereGroup accepts callback', () => {
        const builder = DB.users
          .where({ status: 'active' })
          .whereGroup(qb => qb.where({ name: { startsWith: 'A' } }).orWhere({ name: { startsWith: 'B' } }));
        expectTypeOf(builder.findMany).toBeFunction();
      });

      it('orWhereGroup accepts callback', () => {
        const builder = DB.users
          .where({ status: 'active' })
          .orWhereGroup(qb => qb.where({ name: { startsWith: 'A' } }));
        expectTypeOf(builder.findMany).toBeFunction();
      });
    });

    describe('withId()', () => {
      it('accepts number id', () => {
        const builder = DB.users.withId(1);
        expectTypeOf(builder.findUnique).toBeFunction();
      });

      it('accepts string id', () => {
        const builder = DB.users.withId('abc123');
        expectTypeOf(builder.findUnique).toBeFunction();
      });
    });

    describe('order()', () => {
      it('accepts valid orderBy', () => {
        const builder = DB.users.order({ name: 'asc' });
        expectTypeOf(builder.findMany).toBeFunction();
      });

      it('accepts desc order', () => {
        const builder = DB.users.order({ createdAt: 'desc' });
        expectTypeOf(builder.findMany).toBeFunction();
      });

      it('accepts nulls first/last', () => {
        const builder = DB.users.order({ name: { sort: 'asc', nulls: 'last' } });
        expectTypeOf(builder.findMany).toBeFunction();
      });
    });

    describe('first() / last()', () => {
      it('first returns builder', () => {
        const builder = DB.users.first();
        expectTypeOf(builder.findFirst).toBeFunction();
      });

      it('last returns builder', () => {
        const builder = DB.users.last();
        expectTypeOf(builder.findFirst).toBeFunction();
      });

      it('first accepts field argument', () => {
        const builder = DB.users.first('updatedAt');
        expectTypeOf(builder.findFirst).toBeFunction();
      });
    });

    describe('limit() / skip()', () => {
      it('limit accepts number', () => {
        const builder = DB.users.limit(10);
        expectTypeOf(builder.findMany).toBeFunction();
      });

      it('skip accepts number', () => {
        const builder = DB.users.skip(5);
        expectTypeOf(builder.findMany).toBeFunction();
      });

      it('chained limit and skip', () => {
        const builder = DB.users.limit(10).skip(20);
        expectTypeOf(builder.findMany).toBeFunction();
      });
    });

    describe('distinct()', () => {
      it('accepts field array', () => {
        const builder = DB.users.distinct(['status']);
        expectTypeOf(builder.findMany).toBeFunction();
      });
    });

    describe('select()', () => {
      it('narrows return type', async () => {
        const users = await DB.users.select({ id: true, email: true }).findMany();

        if (users.length > 0) {
          expectTypeOf(users[0].id).toBeNumber();
          expectTypeOf(users[0].email).toBeString();
          // @ts-expect-error - name should not be in type when not selected
          users[0].name;
        }
      });

      it('select maintains builder', () => {
        const builder = DB.users.select({ id: true });
        expectTypeOf(builder.findMany).toBeFunction();
        expectTypeOf(builder.findFirst).toBeFunction();
      });
    });

    describe('only()', () => {
      it('returns single field value', async () => {
        const email = await DB.users.where({ id: 1 }).only('email');
        expectTypeOf(email).toEqualTypeOf<string | null>();
      });

      it('returns nullable for any field', async () => {
        const name = await DB.users.where({ id: 1 }).only('name');
        expectTypeOf(name).toBeNullable();
      });
    });

    describe('when()', () => {
      it('accepts boolean condition', () => {
        const builder = DB.users.when(true, qb => qb.where({ status: 'active' }));
        expectTypeOf(builder.findMany).toBeFunction();
      });

      it('accepts function condition', () => {
        const builder = DB.users.when(() => true, qb => qb.limit(10));
        expectTypeOf(builder.findMany).toBeFunction();
      });
    });

    describe('clone()', () => {
      it('returns new builder instance', () => {
        const original = DB.users.where({ status: 'active' });
        const cloned = original.clone();
        expectTypeOf(cloned.findMany).toBeFunction();
      });
    });

    describe('getQuery()', () => {
      it('returns query object', () => {
        const query = DB.users.where({ status: 'active' }).limit(10).getQuery();
        expectTypeOf(query).toBeObject();
      });
    });
  });

  // ==================== FLARE BUILDER - READ OPERATIONS ====================
  describe('FlareBuilder Read Operations', () => {
    describe('findMany()', () => {
      it('returns array', async () => {
        const users = await DB.users.findMany();
        expectTypeOf(users).toBeArray();
      });

      it('returns typed records', async () => {
        const users = await DB.users.findMany();
        if (users.length > 0) {
          expectTypeOf(users[0].id).toBeNumber();
          expectTypeOf(users[0].email).toBeString();
          expectTypeOf(users[0].name).toEqualTypeOf<string | null>();
        }
      });
    });

    describe('findFirst()', () => {
      it('returns nullable', async () => {
        const user = await DB.users.findFirst();
        expectTypeOf(user).toEqualTypeOf<ExpectedUser | null>();
      });
    });

    describe('findUnique()', () => {
      it('returns nullable', async () => {
        const user = await DB.users.withId(1).findUnique();
        expectTypeOf(user).toBeNullable();
      });
    });

    describe('findFirstOrThrow()', () => {
      it('returns non-null', async () => {
        type Result = Awaited<ReturnType<typeof DB.users.findFirstOrThrow>>;
        expectTypeOf<Result>().not.toBeNull();
      });
    });

    describe('findUniqueOrThrow()', () => {
      it('returns non-null', async () => {
        type Result = Awaited<ReturnType<typeof DB.users.findUniqueOrThrow>>;
        expectTypeOf<Result>().not.toBeNull();
      });
    });

    describe('count()', () => {
      it('returns number', async () => {
        const count = await DB.users.count();
        expectTypeOf(count).toBeNumber();
      });
    });

    describe('exists()', () => {
      it('returns boolean', async () => {
        const exists = await DB.users.where({ id: 1 }).exists();
        expectTypeOf(exists).toBeBoolean();
      });
    });

    describe('pluck()', () => {
      it('returns array of field values', async () => {
        const emails = await DB.users.pluck('email');
        expectTypeOf(emails).toEqualTypeOf<string[]>();
      });

      it('returns correct type for nullable field', async () => {
        const names = await DB.users.pluck('name');
        expectTypeOf(names).toEqualTypeOf<(string | null)[]>();
      });
    });
  });

  // ==================== FLARE BUILDER - WRITE OPERATIONS ====================
  describe('FlareBuilder Write Operations', () => {
    describe('create()', () => {
      it('returns created record', async () => {
        const user = await DB.users.create({ email: 'type@test.com' });

        expectTypeOf(user.id).toBeNumber();
        expectTypeOf(user.email).toBeString();
        expectTypeOf(user.name).toEqualTypeOf<string | null>();
        expectTypeOf(user.status).toBeString();
        expectTypeOf(user.createdAt).toEqualTypeOf<Date>();
        expectTypeOf(user.updatedAt).toEqualTypeOf<Date>();
      });

      it('accepts optional fields', async () => {
        const user = await DB.users.create({
          email: 'test@test.com',
          name: 'Test User',
          status: 'active',
        });
        expectTypeOf(user.name).toEqualTypeOf<string | null>();
      });
    });

    describe('createMany()', () => {
      it('returns batch payload', async () => {
        const result = await DB.users.createMany([
          { email: 'one@test.com' },
          { email: 'two@test.com' },
        ]);
        expectTypeOf(result.count).toBeNumber();
      });
    });

    describe('update()', () => {
      it('returns updated record', async () => {
        const user = await DB.users.withId(1).update({ name: 'Updated' });
        expectTypeOf(user.id).toBeNumber();
        expectTypeOf(user.name).toEqualTypeOf<string | null>();
      });

      it('accepts partial data', async () => {
        const user = await DB.users.withId(1).update({ status: 'inactive' });
        expectTypeOf(user.status).toBeString();
      });
    });

    describe('updateMany()', () => {
      it('returns batch payload', async () => {
        const result = await DB.users.where({ status: 'pending' }).updateMany({ status: 'active' });
        expectTypeOf(result.count).toBeNumber();
      });
    });

    describe('delete()', () => {
      it('returns deleted record', async () => {
        const user = await DB.users.withId(1).delete();
        expectTypeOf(user.id).toBeNumber();
      });
    });

    describe('deleteMany()', () => {
      it('returns batch payload', async () => {
        const result = await DB.users.where({ status: 'deleted' }).deleteMany();
        expectTypeOf(result.count).toBeNumber();
      });
    });

    describe('upsert()', () => {
      it('returns upserted record', async () => {
        const user = await DB.users.upsert({
          where: { id: 1 },
          update: { name: 'Updated' },
          create: { email: 'new@test.com' },
        });
        expectTypeOf(user.id).toBeNumber();
      });
    });
  });

  // ==================== FLARE BUILDER - AGGREGATIONS ====================
  describe('FlareBuilder Aggregations', () => {
    describe('sum()', () => {
      it('returns number or null', async () => {
        const sum = await DB.posts.sum('views');
        expectTypeOf(sum).toEqualTypeOf<number | null>();
      });
    });

    describe('avg()', () => {
      it('returns number or null', async () => {
        const avg = await DB.posts.avg('views');
        expectTypeOf(avg).toEqualTypeOf<number | null>();
      });
    });

    describe('min()', () => {
      it('returns value', async () => {
        const min = await DB.posts.min('views');
        expectTypeOf(min).not.toBeUndefined();
      });
    });

    describe('max()', () => {
      it('returns value', async () => {
        const max = await DB.posts.max('views');
        expectTypeOf(max).not.toBeUndefined();
      });
    });

    describe('groupBy()', () => {
      it('accepts field array', () => {
        const builder = DB.users.groupBy(['status']);
        expectTypeOf(builder.getQuery).toBeFunction();
      });
    });

    describe('having()', () => {
      it('accepts having condition', () => {
        const builder = DB.users.groupBy(['status']).having({ status: { _count: { gt: 1 } } });
        expectTypeOf(builder.getQuery).toBeFunction();
      });
    });
  });

  // ==================== FLARE BUILDER - PAGINATION ====================
  describe('FlareBuilder Pagination', () => {
    describe('paginate()', () => {
      it('returns paginated result', async () => {
        const result = await DB.users.paginate(1, 10);

        expectTypeOf(result.data).toBeArray();
        expectTypeOf(result.meta.total).toBeNumber();
        expectTypeOf(result.meta.lastPage).toBeNumber();
        expectTypeOf(result.meta.currentPage).toBeNumber();
        expectTypeOf(result.meta.perPage).toBeNumber();
        expectTypeOf(result.meta.prev).toEqualTypeOf<number | null>();
        expectTypeOf(result.meta.next).toEqualTypeOf<number | null>();
      });

      it('data contains typed records', async () => {
        const result = await DB.users.paginate();
        if (result.data.length > 0) {
          expectTypeOf(result.data[0].id).toBeNumber();
          expectTypeOf(result.data[0].email).toBeString();
        }
      });
    });

    describe('chunk()', () => {
      it('callback receives typed array', async () => {
        await DB.users.chunk(10, (users) => {
          expectTypeOf(users).toBeArray();
          if (users.length > 0) {
            expectTypeOf(users[0].id).toBeNumber();
          }
        });
      });
    });
  });

  // ==================== INCLUDE / RELATIONS ====================
  describe('Include Types', () => {
    describe('include()', () => {
      it('include adds relation to type', async () => {
        const user = await DB.users.include('posts').findFirst();

        if (user) {
          expectTypeOf(user.posts).toBeArray();
        }
      });

      it('nested include types', async () => {
        const post = await DB.posts.include('author').findFirst();

        if (post) {
          expectTypeOf(post.author.id).toBeNumber();
          expectTypeOf(post.author.email).toBeString();
        }
      });

      it('include with callback', async () => {
        const user = await DB.users
          .include('posts', posts => posts.where({ published: true }))
          .findFirst();

        if (user) {
          expectTypeOf(user.posts).toBeArray();
        }
      });

      it('multiple includes', async () => {
        const user = await DB.users.include('posts').findFirst();

        if (user) {
          expectTypeOf(user.posts).toBeArray();
        }
      });
    });
  });

  // ==================== HOOK TYPES ====================
  describe('Hook Callback Types', () => {
    describe('beforeCreate', () => {
      it('is a function', () => {
        expectTypeOf(beforeCreate).toBeFunction();
      });

      it('callback receives args with data', () => {
        beforeCreate('user', (args) => {
          // args.data exists and has the correct shape
          expectTypeOf(args).toHaveProperty('data');
        });
      });
    });

    describe('afterCreate', () => {
      it('callback receives typed result', () => {
        afterCreate('user', (_args, result) => {
          expectTypeOf(result.id).toBeNumber();
          expectTypeOf(result.email).toBeString();
          expectTypeOf(result.name).toEqualTypeOf<string | null>();
          expectTypeOf(result.status).toBeString();
          expectTypeOf(result.createdAt).toEqualTypeOf<Date>();
          expectTypeOf(result.updatedAt).toEqualTypeOf<Date>();
        });
      });

      it('post model callback', () => {
        afterCreate('post', (_args, result) => {
          expectTypeOf(result.id).toBeNumber();
          expectTypeOf(result.title).toBeString();
          expectTypeOf(result.content).toEqualTypeOf<string | null>();
          expectTypeOf(result.published).toBeBoolean();
          expectTypeOf(result.views).toBeNumber();
          expectTypeOf(result.likes).toBeNumber();
          expectTypeOf(result.authorId).toBeNumber();
        });
      });
    });

    describe('beforeUpdate', () => {
      it('is a function', () => {
        expectTypeOf(beforeUpdate).toBeFunction();
      });

      it('callback receives args with data and where', () => {
        beforeUpdate('user', (args) => {
          // args has data and where properties
          expectTypeOf(args).toHaveProperty('data');
          expectTypeOf(args).toHaveProperty('where');
        });
      });
    });

    describe('afterUpdate', () => {
      it('callback receives typed result', () => {
        afterUpdate('user', (_args, result) => {
          expectTypeOf(result.id).toBeNumber();
          expectTypeOf(result.updatedAt).toEqualTypeOf<Date>();
        });
      });
    });

    describe('beforeDelete', () => {
      it('is a function', () => {
        expectTypeOf(beforeDelete).toBeFunction();
      });

      it('callback receives args with where', () => {
        beforeDelete('user', (args) => {
          // args has where property
          expectTypeOf(args).toHaveProperty('where');
        });
      });
    });

    describe('afterDelete', () => {
      it('callback receives typed result', () => {
        afterDelete('user', (_args, result) => {
          expectTypeOf(result.id).toBeNumber();
        });
      });
    });

    describe('afterChange', () => {
      it('callback signature', () => {
        afterChange('user', 'status', (oldValue, newValue, record) => {
          expectTypeOf(oldValue).toBeAny();
          expectTypeOf(newValue).toBeAny();
          expectTypeOf(record.id).toBeNumber();
          expectTypeOf(record.email).toBeString();
        });
      });

      it('numeric field change', () => {
        afterChange('post', 'views', (oldValue, newValue, record) => {
          expectTypeOf(oldValue).toBeAny();
          expectTypeOf(newValue).toBeAny();
          expectTypeOf(record.title).toBeString();
        });
      });

      it('boolean field change', () => {
        afterChange('post', 'published', (oldValue, newValue, record) => {
          expectTypeOf(oldValue).toBeAny();
          expectTypeOf(newValue).toBeAny();
          expectTypeOf(record.authorId).toBeNumber();
        });
      });
    });
  });

  // ==================== TRANSACTION TYPES ====================
  describe('Transaction Types', () => {
    it('transaction callback receives tx client', async () => {
      await DB.instance.transaction(async (tx) => {
        expectTypeOf(tx.from).toBeFunction();
      });
    });

    it('tx.from returns builder', async () => {
      await DB.instance.transaction(async (tx) => {
        const builder = tx.from('user');
        expectTypeOf(builder.findMany).toBeFunction();
        expectTypeOf(builder.create).toBeFunction();
      });
    });
  });

  // ==================== QUERY BUILDER CHAINING ====================
  describe('Query Builder Chaining', () => {
    it('complex chain maintains types', async () => {
      const result = await DB.users
        .where({ status: 'active' })
        .andWhere({ name: { not: null } })
        .order({ createdAt: 'desc' })
        .limit(10)
        .skip(5)
        .findMany();

      expectTypeOf(result).toBeArray();
    });

    it('chain with include', async () => {
      const result = await DB.users
        .where({ status: 'active' })
        .include('posts')
        .order({ name: 'asc' })
        .findMany();

      if (result.length > 0) {
        expectTypeOf(result[0].posts).toBeArray();
      }
    });

    it('chain with select', async () => {
      const result = await DB.users
        .where({ status: 'active' })
        .select({ id: true, email: true })
        .limit(5)
        .findMany();

      if (result.length > 0) {
        expectTypeOf(result[0].id).toBeNumber();
        expectTypeOf(result[0].email).toBeString();
      }
    });
  });
});
