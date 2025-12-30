/**
 * FlareClient Integration Tests - prisma-client Provider
 *
 * Tests FlareClient-specific functionality with new prisma-client provider.
 * Focuses on prisma-flare features, NOT vanilla Prisma operations.
 */

import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import { DB } from 'prisma-flare/generated';
import { cleanDatabase, disconnectDatabase, getClient } from '../helpers';
import { createUser, createUsers, createUserWithPosts, resetCounters } from '../helpers';

const db = getClient();

describe('FlareClient - prisma-client Provider', () => {
  beforeEach(async () => {
    await cleanDatabase();
    resetCounters();
  });

  afterAll(async () => {
    await disconnectDatabase();
  });

  describe('FlareClient API', () => {
    it('should expose from() method for FlareBuilder access', () => {
      expect(typeof db.from).toBe('function');
    });

    it('should expose transaction() method', () => {
      expect(typeof db.transaction).toBe('function');
    });

    it('should return FlareBuilder from from()', () => {
      const builder = db.from('user');

      expect(typeof builder.where).toBe('function');
      expect(typeof builder.order).toBe('function');
      expect(typeof builder.limit).toBe('function');
      expect(typeof builder.findMany).toBe('function');
    });
  });

  describe('DB.model Static Access', () => {
    it('should expose DB.users with FlareBuilder methods', () => {
      expect(DB.users).toBeDefined();
      expect(typeof DB.users.where).toBe('function');
      expect(typeof DB.users.order).toBe('function');
      expect(typeof DB.users.limit).toBe('function');
      expect(typeof DB.users.skip).toBe('function');
      expect(typeof DB.users.include).toBe('function');
      expect(typeof DB.users.select).toBe('function');
    });

    it('should expose DB.posts with FlareBuilder methods', () => {
      expect(DB.posts).toBeDefined();
      expect(typeof DB.posts.where).toBe('function');
      expect(typeof DB.posts.order).toBe('function');
    });
  });

  describe('FlareBuilder Query Methods', () => {
    it('should filter with where()', async () => {
      await createUser({ name: 'Alice' });
      await createUser({ name: 'Bob' });

      const users = await DB.users.where({ name: 'Alice' }).findMany();

      expect(users).toHaveLength(1);
      expect(users[0].name).toBe('Alice');
    });

    it('should sort with order()', async () => {
      await createUser({ name: 'Charlie' });
      await createUser({ name: 'Alice' });
      await createUser({ name: 'Bob' });

      const users = await DB.users.order({ name: 'asc' }).findMany();

      expect(users[0].name).toBe('Alice');
      expect(users[1].name).toBe('Bob');
      expect(users[2].name).toBe('Charlie');
    });

    it('should paginate with limit() and skip()', async () => {
      await createUsers(10);

      const page = await DB.users.order({ id: 'asc' }).skip(3).limit(2).findMany();

      expect(page).toHaveLength(2);
    });

    it('should chain multiple query methods', async () => {
      await createUser({ name: 'Alice' });
      await createUser({ name: 'Bob' });
      await createUser({ name: 'Charlie' });
      await createUser({ name: 'Anna' });

      const users = await DB.users
        .where({ name: { startsWith: 'A' } })
        .order({ name: 'asc' })
        .limit(1)
        .findMany();

      expect(users).toHaveLength(1);
      expect(users[0].name).toBe('Alice');
    });
  });

  describe('FlareBuilder Convenience Methods', () => {
    it('should use withId() for single record lookup', async () => {
      const created = await createUser({ name: 'Test User' });

      const user = await DB.users.withId(created.id).findUnique();

      expect(user?.name).toBe('Test User');
    });

    it('should use count() for counting records', async () => {
      await createUsers(5);

      const count = await DB.users.count();

      expect(count).toBe(5);
    });

    it('should use exists() to check record existence', async () => {
      const beforeCreate = await DB.users.where({ name: 'Test' }).exists();
      expect(beforeCreate).toBe(false);

      await createUser({ name: 'Test' });

      const afterCreate = await DB.users.where({ name: 'Test' }).exists();
      expect(afterCreate).toBe(true);
    });

    it('should use pluck() to extract single field values', async () => {
      await createUser({ name: 'Alice' });
      await createUser({ name: 'Bob' });

      const names = await DB.users.order({ name: 'asc' }).pluck('name');

      expect(names).toEqual(['Alice', 'Bob']);
    });

    it('should use only() to get single field from first record', async () => {
      await createUser({ name: 'Solo User' });

      const name = await DB.users.only('name');

      expect(name).toBe('Solo User');
    });
  });

  describe('FlareBuilder Relations', () => {
    it('should include relations with include()', async () => {
      const { user } = await createUserWithPosts();

      const result = await DB.users
        .withId(user.id)
        .include('posts')
        .findUnique();

      expect(result?.posts).toHaveLength(2);
    });

    it('should filter included relations', async () => {
      const user = await createUser();
      await DB.posts.create({ title: 'Published', authorId: user.id, published: true });
      await DB.posts.create({ title: 'Draft', authorId: user.id, published: false });

      const result = await DB.users
        .withId(user.id)
        .include('posts', (posts) => posts.where({ published: true }))
        .findUnique();

      expect(result?.posts).toHaveLength(1);
      expect(result?.posts[0].title).toBe('Published');
    });
  });

  describe('FlareBuilder CRUD', () => {
    it('should create with simplified API', async () => {
      const user = await DB.users.create({
        email: 'flare-create@test.com',
        name: 'Flare User',
      });

      expect(user.id).toBeDefined();
      expect(user.email).toBe('flare-create@test.com');
    });

    it('should createMany with array', async () => {
      await DB.users.createMany([
        { email: 'batch1@test.com', name: 'Batch 1' },
        { email: 'batch2@test.com', name: 'Batch 2' },
      ]);

      const count = await DB.users.count();
      expect(count).toBe(2);
    });

    it('should update with FlareBuilder', async () => {
      const user = await createUser({ name: 'Original' });

      const updated = await DB.users.withId(user.id).update({ name: 'Updated' });

      expect(updated.name).toBe('Updated');
    });

    it('should delete with FlareBuilder', async () => {
      const user = await createUser();

      await DB.users.withId(user.id).delete();

      const exists = await DB.users.withId(user.id).exists();
      expect(exists).toBe(false);
    });
  });
});
