/**
 * Query Builder Integration Tests
 */

import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import { DB } from 'prisma-flare/generated';
import { cleanDatabase, disconnectPrisma } from './helpers.js';

describe('FlareBuilder Integration Tests', () => {
  beforeEach(async () => {
    await cleanDatabase();
  });

  afterAll(async () => {
    await disconnectPrisma();
  });

  describe('Basic CRUD Operations', () => {
    it('should create a user', async () => {
      const user = await DB.users.create({
        email: 'test@example.com',
        name: 'Test User',
      });

      expect(user).toBeDefined();
      expect(user.email).toBe('test@example.com');
      expect(user.name).toBe('Test User');
    });

    it('should create many users', async () => {
      const result = await DB.users.createMany([
        { email: 'user1@example.com', name: 'User One' },
        { email: 'user2@example.com', name: 'User Two' },
      ]);

      expect(result.count).toBe(2);
    });

    it('should query users with where condition', async () => {
      await DB.users.createMany([
        { email: 'user1@example.com', name: 'User One' },
        { email: 'user2@example.com', name: 'User Two' },
      ]);

      const users = await DB.users
        .where({ name: { contains: 'One' } })
        .findMany();

      expect(users).toHaveLength(1);
      expect(users[0].name).toBe('User One');
    });

    it('should handle withId', async () => {
      const created = await DB.users.create({
        email: 'test@example.com',
        name: 'Test',
      });

      const found = await DB.users.withId(created.id).findFirst();

      expect(found).toBeDefined();
      expect(found?.id).toBe(created.id);
    });

    it('should update a user', async () => {
      const user = await DB.users.create({
        email: 'test@example.com',
        name: 'Original',
      });

      const updated = await DB.users.withId(user.id).update({
        name: 'Updated'
      });

      expect(updated.name).toBe('Updated');
    });

    it('should update many users', async () => {
      await DB.users.createMany([
        { email: 'u1@example.com', name: 'Old', status: 'pending' },
        { email: 'u2@example.com', name: 'Old', status: 'pending' },
      ]);

      const result = await DB.users.where({ status: 'pending' }).updateMany({
        status: 'active'
      });

      expect(result.count).toBe(2);

      const users = await DB.users.where({ status: 'active' }).findMany();
      expect(users).toHaveLength(2);
    });

    it('should delete a user', async () => {
      const user = await DB.users.create({
        email: 'test@example.com',
        name: 'To Delete',
      });

      const deleted = await DB.users.withId(user.id).delete();
      expect(deleted.id).toBe(user.id);

      const found = await DB.users.withId(user.id).findUnique();
      expect(found).toBeNull();
    });

    it('should delete many users', async () => {
      await DB.users.createMany([
        { email: 'u1@example.com', name: 'Delete Me' },
        { email: 'u2@example.com', name: 'Delete Me' },
        { email: 'u3@example.com', name: 'Keep Me' },
      ]);

      const result = await DB.users.where({ name: 'Delete Me' }).deleteMany();
      expect(result.count).toBe(2);

      const count = await DB.users.count();
      expect(count).toBe(1);
    });

    it('should upsert a user', async () => {
      // Create case
      const created = await DB.users.where({ email: 'upsert@example.com' }).upsert({
        create: { email: 'upsert@example.com', name: 'Created' },
        update: { name: 'Updated' },
      });
      expect(created.name).toBe('Created');

      // Update case
      const updated = await DB.users.where({ email: 'upsert@example.com' }).upsert({
        create: { email: 'upsert@example.com', name: 'Created' },
        update: { name: 'Updated' },
      });
      expect(updated.name).toBe('Updated');
    });
  });

  describe('Query Modifiers', () => {
    it('should limit results', async () => {
      await DB.users.createMany([
        { email: '1@e.com' }, { email: '2@e.com' }, { email: '3@e.com' }
      ]);

      const users = await DB.users.limit(2).findMany();
      expect(users).toHaveLength(2);
    });

    it('should skip results', async () => {
      await DB.users.createMany([
        { email: '1@e.com', name: 'A' },
        { email: '2@e.com', name: 'B' },
        { email: '3@e.com', name: 'C' }
      ]);

      const users = await DB.users.order({ name: 'asc' }).skip(1).findMany();
      expect(users).toHaveLength(2);
      expect(users[0].name).toBe('B');
    });

    it('should order results', async () => {
      await DB.users.createMany([
        { email: 'b@e.com', name: 'B' },
        { email: 'a@e.com', name: 'A' },
      ]);

      const users = await DB.users.order({ name: 'asc' }).findMany();
      expect(users[0].name).toBe('A');
    });

    it('should select specific fields', async () => {
      await DB.users.create({
        email: 'test@example.com',
        name: 'Test',
      });

      const user = await DB.users.select({ email: true }).findFirst();
      expect(user).toHaveProperty('email');
      expect(user).not.toHaveProperty('name');
    });

    it('should use distinct', async () => {
      await DB.users.createMany([
        { email: '1@e.com', name: 'Same' },
        { email: '2@e.com', name: 'Same' },
        { email: '3@e.com', name: 'Different' },
      ]);
    });
  });

  describe('Where Composition (AND/OR logic)', () => {
    it('should compose multiple where() calls with AND logic', async () => {
      await DB.users.createMany([
        { email: 'alice@example.com', name: 'Alice', status: 'active' },
        { email: 'bob@example.com', name: 'Bob', status: 'active' },
        { email: 'alice@other.com', name: 'Alice', status: 'inactive' },
      ]);

      // Multiple where() calls should be AND-ed together
      const users = await DB.users
        .where({ name: 'Alice' })
        .where({ status: 'active' })
        .findMany();

      expect(users).toHaveLength(1);
      expect(users[0].email).toBe('alice@example.com');
    });

    it('should not silently overwrite where conditions with same keys', async () => {
      await DB.users.createMany([
        { email: 'a@example.com', name: 'Alice' },
        { email: 'b@example.com', name: 'Bob' },
        { email: 'ab@example.com', name: 'AliceBob' },
      ]);

      // With old shallow merge, second condition would overwrite first
      // With new AND logic, both conditions must be satisfied
      const users = await DB.users
        .where({ name: { contains: 'Alice' } })
        .where({ name: { contains: 'Bob' } })
        .findMany();

      // Only 'AliceBob' contains both 'Alice' and 'Bob'
      expect(users).toHaveLength(1);
      expect(users[0].name).toBe('AliceBob');
    });

    it('should support andWhere() as explicit alias for where()', async () => {
      await DB.users.createMany([
        { email: 'alice@example.com', name: 'Alice', status: 'active' },
        { email: 'bob@example.com', name: 'Bob', status: 'active' },
      ]);

      const users = await DB.users
        .where({ status: 'active' })
        .andWhere({ name: 'Alice' })
        .findMany();

      expect(users).toHaveLength(1);
      expect(users[0].name).toBe('Alice');
    });

    it('should support orWhere() for OR logic', async () => {
      await DB.users.createMany([
        { email: 'alice@example.com', name: 'Alice', status: 'inactive' },
        { email: 'bob@example.com', name: 'Bob', status: 'active' },
        { email: 'charlie@example.com', name: 'Charlie', status: 'inactive' },
      ]);

      // Should return users who are Alice OR active
      const users = await DB.users
        .where({ name: 'Alice' })
        .orWhere({ status: 'active' })
        .order({ name: 'asc' })
        .findMany();

      expect(users).toHaveLength(2);
      expect(users.map(u => u.name)).toEqual(['Alice', 'Bob']);
    });

    it('should handle complex AND/OR combinations', async () => {
      await DB.users.createMany([
        { email: 'alice-active@example.com', name: 'Alice', status: 'active' },
        { email: 'alice-inactive@example.com', name: 'Alice', status: 'inactive' },
        { email: 'bob-active@example.com', name: 'Bob', status: 'active' },
        { email: 'charlie-inactive@example.com', name: 'Charlie', status: 'inactive' },
      ]);

      // (name = 'Alice' AND status = 'active') OR (name = 'Bob')
      const users = await DB.users
        .where({ name: 'Alice' })
        .where({ status: 'active' })
        .orWhere({ name: 'Bob' })
        .order({ name: 'asc' })
        .findMany();

      expect(users).toHaveLength(2);
      expect(users.map(u => u.name)).toEqual(['Alice', 'Bob']);
      expect(users[0].email).toBe('alice-active@example.com'); // Only active Alice
    });

    it('should work correctly with single where() call', async () => {
      await DB.users.createMany([
        { email: 'alice@example.com', name: 'Alice' },
        { email: 'bob@example.com', name: 'Bob' },
      ]);

      // Single where should work as before
      const users = await DB.users
        .where({ name: 'Alice' })
        .findMany();

      expect(users).toHaveLength(1);
      expect(users[0].name).toBe('Alice');
    });

    it('should preserve query builder chain immutability with clone()', async () => {
      await DB.users.createMany([
        { email: 'alice@example.com', name: 'Alice', status: 'active' },
        { email: 'bob@example.com', name: 'Bob', status: 'active' },
        { email: 'charlie@example.com', name: 'Charlie', status: 'inactive' },
      ]);

      const baseQuery = DB.users.where({ status: 'active' });

      // Clone and add different conditions
      const aliceQuery = baseQuery.clone().where({ name: 'Alice' });
      const bobQuery = baseQuery.clone().where({ name: 'Bob' });

      const alice = await aliceQuery.findMany();
      const bob = await bobQuery.findMany();

      expect(alice).toHaveLength(1);
      expect(alice[0].name).toBe('Alice');
      expect(bob).toHaveLength(1);
      expect(bob[0].name).toBe('Bob');
    });

    it('should properly clone Date objects', async () => {
      const date = new Date('2024-01-15T10:00:00Z');

      await DB.users.create({
        email: 'test@example.com',
        name: 'Test',
        createdAt: date,
      });

      const baseQuery = DB.users.where({ createdAt: { gte: date } });
      const cloned = baseQuery.clone();

      // Both should work with the Date
      const original = await baseQuery.findMany();
      const clonedResult = await cloned.findMany();

      expect(original).toHaveLength(1);
      expect(clonedResult).toHaveLength(1);
    });

    it('should use whereGroup() for explicit boolean grouping', async () => {
      await DB.users.createMany([
        { email: 'alice-active@example.com', name: 'Alice', status: 'active' },
        { email: 'alice-inactive@example.com', name: 'Alice', status: 'inactive' },
        { email: 'bob-active@example.com', name: 'Bob', status: 'active' },
        { email: 'charlie-inactive@example.com', name: 'Charlie', status: 'inactive' },
      ]);

      // (status = 'active') AND (name = 'Alice' OR name = 'Bob')
      const users = await DB.users
        .where({ status: 'active' })
        .whereGroup(qb => qb
          .where({ name: 'Alice' })
          .orWhere({ name: 'Bob' })
        )
        .order({ name: 'asc' })
        .findMany();

      expect(users).toHaveLength(2);
      expect(users.map(u => u.name)).toEqual(['Alice', 'Bob']);
      // Both should be active
      expect(users.every(u => u.status === 'active')).toBe(true);
    });

    it('should use orWhereGroup() for OR-combined groups', async () => {
      await DB.users.createMany([
        { email: 'alice-active@example.com', name: 'Alice', status: 'active' },
        { email: 'bob-inactive@example.com', name: 'Bob', status: 'inactive' },
        { email: 'charlie-admin@example.com', name: 'Charlie', status: 'inactive' },
      ]);

      // (status = 'active') OR (name = 'Charlie' AND status = 'inactive')
      const users = await DB.users
        .where({ status: 'active' })
        .orWhereGroup(qb => qb
          .where({ name: 'Charlie' })
          .where({ status: 'inactive' })
        )
        .order({ name: 'asc' })
        .findMany();

      expect(users).toHaveLength(2);
      expect(users.map(u => u.name)).toEqual(['Alice', 'Charlie']);
    });

    it('should compose withId() using AND logic', async () => {
      await DB.users.createMany([
        { email: 'alice@example.com', name: 'Alice', status: 'active' },
        { email: 'bob@example.com', name: 'Bob', status: 'active' },
      ]);

      const alice = await DB.users.where({ status: 'active' }).findFirst();

      // withId should compose with existing where, not overwrite
      const found = await DB.users
        .where({ status: 'active' })
        .withId(alice!.id)
        .findFirst();

      expect(found).toBeDefined();
      expect(found?.id).toBe(alice!.id);
    });
  });

  describe('Boolean Logic Semantics (query structure assertions)', () => {
    it('chain AND: multiple where() calls produce AND array', () => {
      const query = DB.users
        .where({ status: 'active' })
        .where({ name: 'Alice' })
        .getQuery();

      // Should be { AND: [{ status: 'active' }, { name: 'Alice' }] }
      expect(query.where).toHaveProperty('AND');
      expect(query.where.AND).toHaveLength(2);
      expect(query.where.AND[0]).toEqual({ status: 'active' });
      expect(query.where.AND[1]).toEqual({ name: 'Alice' });
    });

    it('orWhere wraps entire accumulated where in OR', () => {
      const query = DB.users
        .where({ status: 'active' })
        .orWhere({ status: 'pending' })
        .getQuery();

      // Should be { OR: [{ status: 'active' }, { status: 'pending' }] }
      expect(query.where).toHaveProperty('OR');
      expect(query.where.OR).toHaveLength(2);
      expect(query.where.OR[0]).toEqual({ status: 'active' });
      expect(query.where.OR[1]).toEqual({ status: 'pending' });
    });

    it('orWhere followed by where produces (A OR B) AND C', () => {
      const query = DB.users
        .where({ status: 'active' })   // A
        .orWhere({ status: 'pending' })    // OR(A, B)
        .where({ name: { contains: 'test' } })     // AND(OR(A,B), C)
        .getQuery();

      // Outer should be AND
      expect(query.where).toHaveProperty('AND');
      expect(query.where.AND).toHaveLength(2);
      // First element is the OR group
      expect(query.where.AND[0]).toHaveProperty('OR');
      expect(query.where.AND[0].OR).toEqual([
        { status: 'active' },
        { status: 'pending' }
      ]);
      // Second element is the new condition
      expect(query.where.AND[1]).toEqual({ name: { contains: 'test' } });
    });

    it('whereGroup builds A AND (B OR C)', () => {
      const query = DB.users
        .where({ status: 'active' })  // A
        .whereGroup(qb => qb
          .where({ name: 'Alice' })   // B
          .orWhere({ name: 'Bob' })   // B OR C
        )
        .getQuery();

      // Should be { AND: [{ status: 'active' }, { OR: [...] }] }
      expect(query.where).toHaveProperty('AND');
      expect(query.where.AND).toHaveLength(2);
      expect(query.where.AND[0]).toEqual({ status: 'active' });
      expect(query.where.AND[1]).toHaveProperty('OR');
      expect(query.where.AND[1].OR).toEqual([
        { name: 'Alice' },
        { name: 'Bob' }
      ]);
    });

    it('orWhereGroup builds A OR (B AND C)', () => {
      const query = DB.users
        .where({ status: 'active' })  // A
        .orWhereGroup(qb => qb
          .where({ name: 'Alice' })   // B
          .where({ email: { contains: '@example.com' } })  // B AND C
        )
        .getQuery();

      // Should be { OR: [{ status: 'active' }, { AND: [...] }] }
      expect(query.where).toHaveProperty('OR');
      expect(query.where.OR).toHaveLength(2);
      expect(query.where.OR[0]).toEqual({ status: 'active' });
      expect(query.where.OR[1]).toHaveProperty('AND');
      expect(query.where.OR[1].AND).toEqual([
        { name: 'Alice' },
        { email: { contains: '@example.com' } }
      ]);
    });

    it('NOT condition works with where()', async () => {
      await DB.users.createMany([
        { email: 'alice@example.com', name: 'Alice', status: 'active' },
        { email: 'bob@example.com', name: 'Bob', status: 'inactive' },
        { email: 'charlie@example.com', name: 'Charlie', status: 'active' },
      ]);

      // Find active users whose name is NOT Alice
      const users = await DB.users
        .where({ status: 'active' })
        .where({ NOT: { name: 'Alice' } })
        .order({ name: 'asc' })
        .findMany();

      expect(users).toHaveLength(1);
      expect(users[0].name).toBe('Charlie');
    });

    it('nested relation filter works with whereGroup', async () => {
      // Create user with posts
      const user = await DB.users.create({
        email: 'author@example.com',
        name: 'Author',
        status: 'active',
      });

      await DB.posts.createMany([
        { title: 'Published Post', published: true, authorId: user.id },
        { title: 'Draft Post', published: false, authorId: user.id },
      ]);

      // Create another user with no published posts
      const user2 = await DB.users.create({
        email: 'lurker@example.com',
        name: 'Lurker',
        status: 'active',
      });

      await DB.posts.create({
        title: 'Another Draft',
        published: false,
        authorId: user2.id,
      });

      // Find active users who have at least one published post
      const usersWithPublished = await DB.users
        .where({ status: 'active' })
        .where({ posts: { some: { published: true } } })
        .findMany();

      expect(usersWithPublished).toHaveLength(1);
      expect(usersWithPublished[0].name).toBe('Author');
    });

    it('complex real-world query: active users named A* or B*, excluding banned', async () => {
      await DB.users.createMany([
        { email: 'alice@example.com', name: 'Alice', status: 'active' },
        { email: 'bob@example.com', name: 'Bob', status: 'active' },
        { email: 'adam@example.com', name: 'Adam', status: 'banned' },
        { email: 'charlie@example.com', name: 'Charlie', status: 'active' },
      ]);

      // (status = 'active') AND (name LIKE 'A%' OR name LIKE 'B%') AND NOT(status = 'banned')
      const users = await DB.users
        .where({ status: 'active' })
        .whereGroup(qb => qb
          .where({ name: { startsWith: 'A' } })
          .orWhere({ name: { startsWith: 'B' } })
        )
        .where({ NOT: { status: 'banned' } })
        .order({ name: 'asc' })
        .findMany();

      expect(users).toHaveLength(2);
      expect(users.map(u => u.name)).toEqual(['Alice', 'Bob']);
    });
  });
});
