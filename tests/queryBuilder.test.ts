/**
 * Query Builder Integration Tests
 */

import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import { db } from '../src';
import { cleanDatabase, disconnectPrisma } from './helpers';

describe('QueryBuilder Integration Tests', () => {
  beforeEach(async () => {
    await cleanDatabase();
  });

  afterAll(async () => {
    await disconnectPrisma();
  });

  describe('Basic CRUD Operations', () => {
    it('should create a user', async () => {
      const user = await db.query('user').create({
        data: {
          email: 'test@example.com',
          name: 'Test User',
        },
      });

      expect(user).toBeDefined();
      expect(user.email).toBe('test@example.com');
      expect(user.name).toBe('Test User');
    });

    it('should query users with where condition', async () => {
      // Create test users
      await db.query('user').createMany({
        data: [
          { email: 'user1@example.com', name: 'User One' },
          { email: 'user2@example.com', name: 'User Two' },
          { email: 'user3@example.com', name: 'User Three' },
        ],
      });

      // Query with QueryBuilder
      const users = await db
        .query('user')
        .where({ name: { contains: 'One' } })
        .findMany();

      expect(users).toHaveLength(1);
      expect(users[0].name).toBe('User One');
    });

    it('should handle whereId', async () => {
      const created = await db.query('user').create({
        data: { email: 'test@example.com', name: 'Test' },
      });

      const found = await db.query('user').whereId(created.id).findFirst();

      expect(found).toBeDefined();
      expect(found?.id).toBe(created.id);
    });

    it('should limit results', async () => {
      await db.query('user').createMany({
        data: [
          { email: 'user1@example.com', name: 'User 1' },
          { email: 'user2@example.com', name: 'User 2' },
          { email: 'user3@example.com', name: 'User 3' },
        ],
      });

      const users = await db.query('user').limit(2).findMany();

      expect(users).toHaveLength(2);
    });

    it('should order results', async () => {
      await db.query('user').createMany({
        data: [
          { email: 'b@example.com', name: 'B User' },
          { email: 'a@example.com', name: 'A User' },
          { email: 'c@example.com', name: 'C User' },
        ],
      });

      const users = await db
        .query('user')
        .order({ name: 'asc' })
        .findMany();

      expect(users[0].name).toBe('A User');
      expect(users[1].name).toBe('B User');
      expect(users[2].name).toBe('C User');
    });
  });

  describe('Advanced Query Operations', () => {
    it('should select specific fields', async () => {
      await db.query('user').create({
        data: { email: 'test@example.com', name: 'Test User' },
      });

      const users = await db
        .query('user')
        .select({ id: true, email: true })
        .findMany();

      expect(users[0]).toHaveProperty('id');
      expect(users[0]).toHaveProperty('email');
      expect(users[0]).not.toHaveProperty('name');
    });

    it('should get only a single field value', async () => {
      await db.query('user').create({
        data: { email: 'test@example.com', name: 'Test User' },
      });

      const email = await db.query('user').only('email');

      expect(email).toBe('test@example.com');
    });

    it('should check if record exists', async () => {
      await db.query('user').create({
        data: { email: 'test@example.com', name: 'Test User' },
      });

      const exists = await db
        .query('user')
        .where({ email: 'test@example.com' })
        .exists();

      const notExists = await db
        .query('user')
        .where({ email: 'nonexistent@example.com' })
        .exists();

      expect(exists).toBe(true);
      expect(notExists).toBe(false);
    });

    it('should count records', async () => {
      await db.query('user').createMany({
        data: [
          { email: 'user1@example.com', name: 'User 1' },
          { email: 'user2@example.com', name: 'User 2' },
          { email: 'user3@example.com', name: 'User 3' },
        ],
      });

      const count = await db.query('user').count();

      expect(count).toBe(3);
    });

    it('should skip records', async () => {
      await db.query('user').createMany({
        data: [
          { email: 'user1@example.com', name: 'User 1' },
          { email: 'user2@example.com', name: 'User 2' },
          { email: 'user3@example.com', name: 'User 3' },
        ],
      });

      const users = await db
        .query('user')
        .order({ id: 'asc' })
        .skip(1)
        .findMany();

      expect(users).toHaveLength(2);
    });

    it('should pluck specific fields', async () => {
      await db.query('user').createMany({
        data: [
          { email: 'user1@example.com', name: 'User 1' },
          { email: 'user2@example.com', name: 'User 2' },
        ],
      });

      const emails = await db.query('user').pluck({ email: true });

      expect(emails).toEqual(['user1@example.com', 'user2@example.com']);
    });
  });

  describe('Relations', () => {
    it('should include relations', async () => {
      const user = await db.query('user').create({
        data: {
          email: 'author@example.com',
          name: 'Author',
          posts: {
            create: [
              { title: 'Post 1', content: 'Content 1' },
              { title: 'Post 2', content: 'Content 2' },
            ],
          },
        },
      });

      const userWithPosts = await db
        .query('user')
        .whereId(user.id)
        .include({ posts: true })
        .findFirst();

      expect(userWithPosts?.posts).toHaveLength(2);
    });

    it('should query posts with author relation', async () => {
      await db.query('user').create({
        data: {
          email: 'author@example.com',
          name: 'Author',
          posts: {
            create: [
              { title: 'Published Post', content: 'Content', published: true },
            ],
          },
        },
      });

      const posts = await db
        .query('post')
        .where({ published: true })
        .include({ author: true })
        .findMany();

      expect(posts).toHaveLength(1);
      expect(posts[0].author.email).toBe('author@example.com');
    });
  });

  describe('Helper Methods', () => {
    it('should get first record', async () => {
      await db.query('user').createMany({
        data: [
          { email: 'old@example.com', name: 'Old User' },
          { email: 'new@example.com', name: 'New User' },
        ],
      });

      const first = await db.query('user').first('createdAt').findFirst();

      expect(first).toBeDefined();
    });

    it('should get last record', async () => {
      await db.query('user').createMany({
        data: [
          { email: 'old@example.com', name: 'Old User' },
          { email: 'new@example.com', name: 'New User' },
        ],
      });

      const last = await db.query('user').last('createdAt').findFirst();

      expect(last).toBeDefined();
    });
  });
});
