/**
 * Query Builder Integration Tests
 */

import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import { db } from '../src/core/db';
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

    it('should create many users', async () => {
      const result = await db.query('user').createMany({
        data: [
          { email: 'user1@example.com', name: 'User One' },
          { email: 'user2@example.com', name: 'User Two' },
        ],
      });

      expect(result.count).toBe(2);
    });

    it('should query users with where condition', async () => {
      await db.query('user').createMany({
        data: [
          { email: 'user1@example.com', name: 'User One' },
          { email: 'user2@example.com', name: 'User Two' },
        ],
      });

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

    it('should update a user', async () => {
      const user = await db.query('user').create({
        data: { email: 'test@example.com', name: 'Original' },
      });

      const updated = await db.query('user').whereId(user.id).update({
        data: { name: 'Updated' },
      });

      expect(updated.name).toBe('Updated');
    });

    it('should update many users', async () => {
      await db.query('user').createMany({
        data: [
          { email: 'u1@example.com', name: 'Old', status: 'pending' },
          { email: 'u2@example.com', name: 'Old', status: 'pending' },
        ],
      });

      const result = await db.query('user').where({ status: 'pending' }).updateMany({
        data: { status: 'active' },
      });

      expect(result.count).toBe(2);
      
      const users = await db.query('user').where({ status: 'active' }).findMany();
      expect(users).toHaveLength(2);
    });

    it('should delete a user', async () => {
      const user = await db.query('user').create({
        data: { email: 'test@example.com', name: 'To Delete' },
      });

      const deleted = await db.query('user').whereId(user.id).delete();
      expect(deleted.id).toBe(user.id);

      const found = await db.query('user').whereId(user.id).findUnique();
      expect(found).toBeNull();
    });

    it('should delete many users', async () => {
      await db.query('user').createMany({
        data: [
          { email: 'u1@example.com', name: 'Delete Me' },
          { email: 'u2@example.com', name: 'Delete Me' },
          { email: 'u3@example.com', name: 'Keep Me' },
        ],
      });

      const result = await db.query('user').where({ name: 'Delete Me' }).deleteMany();
      expect(result.count).toBe(2);

      const count = await db.query('user').count();
      expect(count).toBe(1);
    });

    it('should upsert a user', async () => {
      // Create case
      const created = await db.query('user').where({ email: 'upsert@example.com' }).upsert({
        create: { email: 'upsert@example.com', name: 'Created' },
        update: { name: 'Updated' },
      });
      expect(created.name).toBe('Created');

      // Update case
      const updated = await db.query('user').where({ email: 'upsert@example.com' }).upsert({
        create: { email: 'upsert@example.com', name: 'Created' },
        update: { name: 'Updated' },
      });
      expect(updated.name).toBe('Updated');
    });
  });

  describe('Query Modifiers', () => {
    it('should limit results', async () => {
      await db.query('user').createMany({
        data: [
          { email: '1@e.com' }, { email: '2@e.com' }, { email: '3@e.com' }
        ],
      });

      const users = await db.query('user').limit(2).findMany();
      expect(users).toHaveLength(2);
    });

    it('should skip results', async () => {
      await db.query('user').createMany({
        data: [
          { email: '1@e.com', name: 'A' }, 
          { email: '2@e.com', name: 'B' }, 
          { email: '3@e.com', name: 'C' }
        ],
      });

      const users = await db.query('user').order({ name: 'asc' }).skip(1).findMany();
      expect(users).toHaveLength(2);
      expect(users[0].name).toBe('B');
    });

    it('should order results', async () => {
      await db.query('user').createMany({
        data: [
          { email: 'b@e.com', name: 'B' },
          { email: 'a@e.com', name: 'A' },
        ],
      });

      const users = await db.query('user').order({ name: 'asc' }).findMany();
      expect(users[0].name).toBe('A');
    });

    it('should select specific fields', async () => {
      await db.query('user').create({
        data: { email: 'test@example.com', name: 'Test' },
      });

      const user = await db.query('user').select({ email: true }).findFirst();
      expect(user).toHaveProperty('email');
      expect(user).not.toHaveProperty('name');
    });

    it('should use distinct', async () => {
      await db.query('user').createMany({
        data: [
          { email: '1@e.com', name: 'Same' },
          { email: '2@e.com', name: 'Same' },
          { email: '3@e.com', name: 'Different' },
        ],
      });

      const users = await db.query('user').distinct(['name']).order({ name: 'asc' }).findMany();
      expect(users).toHaveLength(2);
    });
  });

  describe('Advanced Retrieval', () => {
    it('should get only a single field value', async () => {
      await db.query('user').create({
        data: { email: 'test@example.com' },
      });

      const email = await db.query('user').only('email');
      expect(email).toBe('test@example.com');
    });

    it('should pluck values', async () => {
      await db.query('user').createMany({
        data: [
          { email: '1@e.com' }, { email: '2@e.com' }
        ],
      });

      const emails = await db.query('user').order({ email: 'asc' }).pluck('email');
      expect(emails).toEqual(['1@e.com', '2@e.com']);
    });

    it('should check existence', async () => {
      await db.query('user').create({ data: { email: 'exist@e.com' } });
      
      const exists = await db.query('user').where({ email: 'exist@e.com' }).exists();
      const notExists = await db.query('user').where({ email: 'nope@e.com' }).exists();

      expect(exists).toBe(true);
      expect(notExists).toBe(false);
    });

    it('should find first or throw', async () => {
      await db.query('user').create({ data: { email: 'exist@e.com' } });

      await expect(db.query('user').where({ email: 'exist@e.com' }).findFirstOrThrow())
        .resolves.toBeDefined();

      await expect(db.query('user').where({ email: 'nope@e.com' }).findFirstOrThrow())
        .rejects.toThrow();
    });

    it('should find unique or throw', async () => {
      const user = await db.query('user').create({ data: { email: 'exist@e.com' } });

      await expect(db.query('user').whereId(user.id).findUniqueOrThrow())
        .resolves.toBeDefined();

      await expect(db.query('user').whereId(99999).findUniqueOrThrow())
        .rejects.toThrow();
    });
  });

  describe('Aggregations', () => {
    beforeEach(async () => {
      const user = await db.query('user').create({
        data: { email: 'author@e.com' },
      });

      await db.query('post').createMany({
        data: [
          { title: 'P1', views: 10, likes: 5, authorId: user.id },
          { title: 'P2', views: 20, likes: 15, authorId: user.id },
          { title: 'P3', views: 30, likes: 10, authorId: user.id },
        ],
      });
    });

    it('should count records', async () => {
      const count = await db.query('post').count();
      expect(count).toBe(3);
    });

    it('should sum fields', async () => {
      const totalViews = await db.query('post').sum('views');
      expect(totalViews).toBe(60);
    });

    it('should avg fields', async () => {
      const avgLikes = await db.query('post').avg('likes');
      expect(avgLikes).toBe(10);
    });

    it('should min fields', async () => {
      const minViews = await db.query('post').min('views');
      expect(minViews).toBe(10);
    });

    it('should max fields', async () => {
      const maxLikes = await db.query('post').max('likes');
      expect(maxLikes).toBe(15);
    });
  });

  describe('New Features', () => {
    it('should paginate results', async () => {
      await db.query('user').createMany({
        data: Array.from({ length: 25 }, (_, i) => ({ email: `user${i}@e.com` })),
      });

      const page1 = await db.query('user').order({ email: 'asc' }).paginate(1, 10);
      expect(page1.data).toHaveLength(10);
      expect(page1.meta.total).toBe(25);
      expect(page1.meta.lastPage).toBe(3);
      expect(page1.meta.next).toBe(2);

      const page3 = await db.query('user').order({ email: 'asc' }).paginate(3, 10);
      expect(page3.data).toHaveLength(5);
      expect(page3.meta.next).toBeNull();
    });

    it('should use when condition', async () => {
      await db.query('user').create({ data: { email: 'target@e.com', name: 'Target' } });
      await db.query('user').create({ data: { email: 'other@e.com', name: 'Other' } });

      const shouldFilter = true;
      const users = await db.query('user')
        .when(shouldFilter, (q) => q.where({ name: 'Target' }))
        .findMany();

      expect(users).toHaveLength(1);
      expect(users[0].name).toBe('Target');

      const shouldNotFilter = false;
      const allUsers = await db.query('user')
        .when(shouldNotFilter, (q) => q.where({ name: 'Target' }))
        .findMany();

      expect(allUsers).toHaveLength(2);
    });

    it('should chunk results', async () => {
      await db.query('user').createMany({
        data: Array.from({ length: 15 }, (_, i) => ({ email: `user${i}@e.com` })),
      });

      let processedCount = 0;
      let chunkCount = 0;

      await db.query('user').chunk(5, async (users) => {
        chunkCount++;
        processedCount += users.length;
      });

      expect(chunkCount).toBe(3);
      expect(processedCount).toBe(15);
    });

    it('should clone query builder', async () => {
      await db.query('user').create({ data: { email: 'test@e.com' } });

      const baseQuery = db.query('user').where({ email: 'test@e.com' });
      const countQuery = baseQuery.clone();

      const count = await countQuery.count();
      const user = await baseQuery.findFirst();

      expect(count).toBe(1);
      expect(user).toBeDefined();
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
              { title: 'Post 1' },
            ],
          },
        },
      });

      const userWithPosts = await db
        .query('user')
        .whereId(user.id)
        .include({ posts: true })
        .findFirst();

      expect(userWithPosts?.posts).toHaveLength(1);
    });
  });
});
