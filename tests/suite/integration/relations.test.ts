/**
 * Relations Tests
 *
 * Tests include, nested creates, and relation filtering.
 */

import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import { DB } from 'prisma-flare/generated';
import { hookRegistry } from 'prisma-flare';
import { cleanDatabase, disconnect, resetCounter, uniqueEmail } from '#test-helpers';

describe('Relations', () => {
  beforeEach(async () => {
    await cleanDatabase();
    hookRegistry.clearAll();
    resetCounter();
  });

  afterAll(async () => {
    await disconnect();
  });

  // ==================== INCLUDE ====================
  describe('include', () => {
    it('includes has-many relation', async () => {
      const user = await DB.users.create({ email: uniqueEmail() });
      await DB.posts.createMany([
        { title: 'Post 1', authorId: user.id },
        { title: 'Post 2', authorId: user.id },
      ]);

      const result = await DB.users.withId(user.id).include('posts').findUnique();

      expect(result?.posts).toHaveLength(2);
    });

    it('includes belongs-to relation', async () => {
      const user = await DB.users.create({ email: uniqueEmail(), name: 'Author' });
      const post = await DB.posts.create({ title: 'Test Post', authorId: user.id });

      const result = await DB.posts.withId(post.id).include('author').findUnique();

      expect(result?.author).toBeDefined();
      expect(result?.author.name).toBe('Author');
    });

    it('includes with filtering', async () => {
      const user = await DB.users.create({ email: uniqueEmail() });
      await DB.posts.createMany([
        { title: 'Published', authorId: user.id, published: true },
        { title: 'Draft 1', authorId: user.id, published: false },
        { title: 'Draft 2', authorId: user.id, published: false },
      ]);

      const result = await DB.users
        .withId(user.id)
        .include('posts', (posts) => posts.where({ published: true }))
        .findUnique();

      expect(result?.posts).toHaveLength(1);
      expect(result?.posts[0].title).toBe('Published');
    });

    it('includes with ordering', async () => {
      const user = await DB.users.create({ email: uniqueEmail() });
      await DB.posts.create({ title: 'C Post', authorId: user.id });
      await DB.posts.create({ title: 'A Post', authorId: user.id });
      await DB.posts.create({ title: 'B Post', authorId: user.id });

      const result = await DB.users
        .withId(user.id)
        .include('posts', (posts) => posts.order({ title: 'asc' }))
        .findUnique();

      expect(result?.posts[0].title).toBe('A Post');
      expect(result?.posts[1].title).toBe('B Post');
      expect(result?.posts[2].title).toBe('C Post');
    });

    it('includes with limit', async () => {
      const user = await DB.users.create({ email: uniqueEmail() });
      for (let i = 0; i < 5; i++) {
        await DB.posts.create({ title: `Post ${i}`, authorId: user.id });
      }

      const result = await DB.users
        .withId(user.id)
        .include('posts', (posts) => posts.limit(2))
        .findUnique();

      expect(result?.posts).toHaveLength(2);
    });
  });

  // ==================== NESTED CREATES ====================
  describe('nested creates', () => {
    it('creates parent with children', async () => {
      const user = await DB.users.include('posts').create({
        email: uniqueEmail(),
        posts: {
          create: [
            { title: 'First Post' },
            { title: 'Second Post' },
          ],
        },
      });

      expect(user.posts).toHaveLength(2);
      expect(user.posts.map((p: { title: string }) => p.title)).toContain('First Post');
    });

    it('creates child with parent reference', async () => {
      const user = await DB.users.create({ email: uniqueEmail() });

      const post = await DB.posts.include('author').create({
        title: 'New Post',
        authorId: user.id,
      });

      expect(post.author.id).toBe(user.id);
    });
  });

  // ==================== RELATION QUERIES ====================
  describe('relation queries', () => {
    beforeEach(async () => {
      const alice = await DB.users.create({ email: 'alice@test.com', name: 'Alice' });
      const bob = await DB.users.create({ email: 'bob@test.com', name: 'Bob' });

      await DB.posts.createMany([
        { title: 'Alice Post 1', authorId: alice.id, published: true },
        { title: 'Alice Post 2', authorId: alice.id, published: false },
        { title: 'Bob Post 1', authorId: bob.id, published: true },
      ]);
    });

    it('finds users with posts', async () => {
      const usersWithPosts = await DB.users
        .where({ posts: { some: {} } })
        .include('posts')
        .findMany();

      expect(usersWithPosts).toHaveLength(2);
      expect(usersWithPosts.every(u => u.posts.length > 0)).toBe(true);
    });

    it('finds users with published posts', async () => {
      const users = await DB.users
        .where({ posts: { some: { published: true } } })
        .findMany();

      expect(users).toHaveLength(2);
    });

    it('counts posts per user', async () => {
      const users = await DB.users
        .include('posts')
        .findMany();

      const alice = users.find(u => u.name === 'Alice');
      const bob = users.find(u => u.name === 'Bob');

      expect(alice?.posts).toHaveLength(2);
      expect(bob?.posts).toHaveLength(1);
    });
  });

  // ==================== SELECT WITH RELATIONS ====================
  describe('select with relations', () => {
    it('selects specific fields from relation', async () => {
      const user = await DB.users.create({ email: uniqueEmail() });
      await DB.posts.create({
        title: 'Test',
        content: 'Content',
        authorId: user.id,
        views: 100,
      });

      const result = await DB.users
        .withId(user.id)
        .select({
          id: true,
          email: true,
          posts: {
            select: {
              id: true,
              title: true,
            },
          },
        })
        .findUnique();

      expect(result?.posts[0]).toHaveProperty('id');
      expect(result?.posts[0]).toHaveProperty('title');
      expect(result?.posts[0]).not.toHaveProperty('content');
      expect(result?.posts[0]).not.toHaveProperty('views');
    });
  });
});
