/**
 * FlareBuilder Integration Tests - prisma-client Provider
 *
 * Verifies FlareBuilder query chaining works correctly with new prisma-client provider
 */

import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import { DB } from 'prisma-flare/generated';
import { cleanDatabase, disconnectDatabase, getClient } from '../helpers';
import { createUser, createUsers, createUserWithPosts, resetCounters } from '../helpers';

const db = getClient();

describe('FlareBuilder - prisma-client Provider', () => {
  beforeEach(async () => {
    await cleanDatabase();
    resetCounters();
  });

  afterAll(async () => {
    await disconnectDatabase();
  });

  describe('from() Method', () => {
    it('should create builder with from()', async () => {
      await createUser({ email: 'builder@test.com' });

      const users = await db.from('user').where({ email: 'builder@test.com' }).findMany();

      expect(users).toHaveLength(1);
      expect(users[0].email).toBe('builder@test.com');
    });

    it('should support findFirst()', async () => {
      await createUser({ email: 'first@test.com' });

      const user = await db.from('user').where({ email: 'first@test.com' }).findFirst();

      expect(user).not.toBeNull();
      expect(user?.email).toBe('first@test.com');
    });
  });

  describe('Query Chaining', () => {
    it('should chain where() and order()', async () => {
      await createUser({ name: 'Charlie' });
      await createUser({ name: 'Alice' });
      await createUser({ name: 'Bob' });

      const users = await db
        .from('user')
        .where({ name: { not: null } })
        .order({ name: 'asc' })
        .findMany();

      expect(users[0].name).toBe('Alice');
      expect(users[1].name).toBe('Bob');
      expect(users[2].name).toBe('Charlie');
    });

    it('should chain where() and limit()', async () => {
      await createUsers(5);

      const users = await db.from('user').limit(2).findMany();

      expect(users).toHaveLength(2);
    });

    it('should chain where(), order(), and limit()', async () => {
      await createUser({ name: 'Charlie' });
      await createUser({ name: 'Alice' });
      await createUser({ name: 'Bob' });
      await createUser({ name: 'David' });

      const users = await db
        .from('user')
        .order({ name: 'asc' })
        .limit(2)
        .findMany();

      expect(users).toHaveLength(2);
      expect(users[0].name).toBe('Alice');
      expect(users[1].name).toBe('Bob');
    });
  });

  describe('FlareBuilder include()', () => {
    it('should include relations', async () => {
      const { user } = await createUserWithPosts();

      const users = await db
        .from('user')
        .where({ id: user.id })
        .include('posts')
        .findMany() as any[];

      expect(users[0].posts).toHaveLength(2);
    });
  });

  describe('DB.models Pattern', () => {
    it('should access DB.users', () => {
      expect(DB.users).toBeDefined();
      expect(typeof DB.users.where).toBe('function');
      expect(typeof DB.users.findMany).toBe('function');
    });

    it('should access DB.posts', () => {
      expect(DB.posts).toBeDefined();
      expect(typeof DB.posts.where).toBe('function');
    });

    it('should create user with DB.users', async () => {
      const user = await (DB.users as any).create({
        email: 'db-users@test.com',
        name: 'DB Users',
      });

      expect(user.id).toBeDefined();
      expect(user.email).toBe('db-users@test.com');
    });

    it('should query with DB.users.where()', async () => {
      await (DB.users as any).create({ email: 'query@test.com', name: 'Query User' });

      const users = await (DB.users as any).where({ email: 'query@test.com' }).findMany();

      expect(users).toHaveLength(1);
      expect(users[0].name).toBe('Query User');
    });

    it('should chain queries with DB.users', async () => {
      await (DB.users as any).createMany([
        { email: 'a@test.com', name: 'Alice' },
        { email: 'b@test.com', name: 'Bob' },
        { email: 'c@test.com', name: 'Charlie' },
      ]);

      const users = await (DB.users as any).order({ name: 'asc' }).limit(2).findMany();

      expect(users).toHaveLength(2);
      expect(users[0].name).toBe('Alice');
    });

    it('should include relations with DB.users', async () => {
      const user = await (DB.users as any).create({ email: 'include@test.com', name: 'Include User' });
      await (DB.posts as any).create({ title: 'User Post', authorId: user.id });

      const usersWithPosts = await (DB.users as any)
        .where({ id: user.id })
        .include('posts')
        .findMany();

      expect(usersWithPosts[0].posts).toHaveLength(1);
    });
  });
});
