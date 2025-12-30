/**
 * Custom Model Classes Tests
 *
 * Tests for custom model classes that extend FlareBuilder with domain-specific methods.
 * These tests verify that custom query methods work correctly.
 */

import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import {
  DB,
  User,
  Post,
  cleanDatabase,
  disconnect,
  createUser,
  createUserWithPosts,
  uniqueEmail,
} from '#test-helpers';

describe('Custom Model Classes', () => {
  beforeEach(async () => {
    await cleanDatabase();
  });

  afterAll(async () => {
    await disconnect();
  });

  // ==================== USER CUSTOM METHODS ====================
  describe('User custom methods', () => {
    it('withName() filters by name containing string', async () => {
      await createUser({ name: 'John Doe', email: uniqueEmail() });
      await createUser({ name: 'Jane Smith', email: uniqueEmail() });
      await createUser({ name: 'Bob Johnson', email: uniqueEmail() });

      const users = await new User().withName('John').findMany();
      expect(users).toHaveLength(2); // John Doe and Bob Johnson
      expect(users.every((u) => u.name?.includes('John'))).toBe(true);
    });

    it('withEmail() filters by exact email', async () => {
      const targetEmail = uniqueEmail();
      await createUser({ email: targetEmail });
      await createUser({ email: uniqueEmail() });

      const users = await new User().withEmail(targetEmail).findMany();
      expect(users).toHaveLength(1);
      expect(users[0].email).toBe(targetEmail);
    });

    it('createdAfter() filters by creation date', async () => {
      const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000);
      await createUser({ email: uniqueEmail() });

      const users = await new User().createdAfter(yesterday).findMany();
      expect(users.length).toBeGreaterThan(0);
      expect(users.every((u) => u.createdAt > yesterday)).toBe(true);
    });

    it('chains multiple custom methods', async () => {
      const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000);
      await createUser({ name: 'John Doe', email: uniqueEmail() });
      await createUser({ name: 'Jane Smith', email: uniqueEmail() });

      const users = await new User()
        .withName('John')
        .createdAfter(yesterday)
        .findMany();

      expect(users).toHaveLength(1);
      expect(users[0].name).toContain('John');
    });

    it('custom methods work with standard query methods', async () => {
      await createUser({ name: 'Alice', email: uniqueEmail() });
      await createUser({ name: 'Alice B', email: uniqueEmail() });
      await createUser({ name: 'Alice C', email: uniqueEmail() });

      const users = await new User()
        .withName('Alice')
        .order({ name: 'asc' })
        .limit(2)
        .findMany();

      expect(users).toHaveLength(2);
      expect(users[0].name).toBe('Alice');
    });
  });

  // ==================== POST CUSTOM METHODS ====================
  describe('Post custom methods', () => {
    it('published() filters published posts', async () => {
      const { user } = await createUserWithPosts({}, 3);

      // Create additional published post
      await DB.posts.create({
        title: 'Published Post',
        authorId: user.id,
        published: true,
      });

      const posts = await new Post().published().findMany();
      expect(posts.every((p) => p.published === true)).toBe(true);
    });

    it('drafts() filters unpublished posts', async () => {
      const { user } = await createUserWithPosts({}, 3);

      const drafts = await new Post().drafts().findMany();
      expect(drafts.length).toBeGreaterThan(0);
      expect(drafts.every((p) => p.published === false)).toBe(true);
    });

    it('recent(count) returns limited posts ordered by createdAt desc', async () => {
      const { user } = await createUserWithPosts({}, 5);

      const recent = await new Post().recent(2).findMany();
      expect(recent).toHaveLength(2);
      // Verify ordering - first should be most recent
      expect(recent[0].createdAt.getTime()).toBeGreaterThanOrEqual(
        recent[1].createdAt.getTime()
      );
    });

    it('withTitle() filters by title containing string', async () => {
      const user = await createUser({ email: uniqueEmail() });
      await DB.posts.create({ title: 'Introduction to Testing', authorId: user.id });
      await DB.posts.create({ title: 'Advanced Testing', authorId: user.id });
      await DB.posts.create({ title: 'Database Design', authorId: user.id });

      const posts = await new Post().withTitle('Testing').findMany();
      expect(posts).toHaveLength(2);
      expect(posts.every((p) => p.title.includes('Testing'))).toBe(true);
    });

    it('withAuthorId() filters by author', async () => {
      const user1 = await createUser({ email: uniqueEmail() });
      const user2 = await createUser({ email: uniqueEmail() });

      await DB.posts.create({ title: 'Post 1', authorId: user1.id });
      await DB.posts.create({ title: 'Post 2', authorId: user1.id });
      await DB.posts.create({ title: 'Post 3', authorId: user2.id });

      const posts = await new Post().withAuthorId(user1.id).findMany();
      expect(posts).toHaveLength(2);
      expect(posts.every((p) => p.authorId === user1.id)).toBe(true);
    });

    it('chains multiple custom methods', async () => {
      const user = await createUser({ email: uniqueEmail() });
      await DB.posts.create({ title: 'Published Test', authorId: user.id, published: true });
      await DB.posts.create({ title: 'Draft Test', authorId: user.id, published: false });
      await DB.posts.create({ title: 'Published Other', authorId: user.id, published: true });

      const posts = await new Post()
        .published()
        .withTitle('Test')
        .findMany();

      expect(posts).toHaveLength(1);
      expect(posts[0].title).toBe('Published Test');
      expect(posts[0].published).toBe(true);
    });

    it('custom methods work with aggregations', async () => {
      const user = await createUser({ email: uniqueEmail() });
      await DB.posts.create({ title: 'Post 1', authorId: user.id, published: true, views: 100 });
      await DB.posts.create({ title: 'Post 2', authorId: user.id, published: true, views: 200 });
      await DB.posts.create({ title: 'Post 3', authorId: user.id, published: false, views: 50 });

      const count = await new Post().published().count();
      expect(count).toBe(2);

      const exists = await new Post().drafts().exists();
      expect(exists).toBe(true);

      const totalViews = await new Post().published().sum('views');
      expect(totalViews).toBe(300);
    });
  });

  // ==================== ADVANCED CHAINING ====================
  describe('Advanced chaining', () => {
    it('combines custom methods with where conditions', async () => {
      const user = await createUser({ name: 'Test Author', email: uniqueEmail() });
      await DB.posts.create({
        title: 'Featured Post',
        authorId: user.id,
        published: true,
        views: 1000,
      });
      await DB.posts.create({
        title: 'Regular Post',
        authorId: user.id,
        published: true,
        views: 10,
      });

      const posts = await new Post()
        .published()
        .where({ views: { gte: 100 } })
        .findMany();

      expect(posts).toHaveLength(1);
      expect(posts[0].title).toBe('Featured Post');
    });

    it('custom methods preserve return type for findFirst', async () => {
      const user = await createUser({ email: uniqueEmail() });
      await DB.posts.create({ title: 'Only Post', authorId: user.id, published: true });

      const post = await new Post().published().findFirst();
      expect(post).not.toBeNull();
      expect(post?.published).toBe(true);
    });

    it('custom methods work with pagination', async () => {
      const user = await createUser({ email: uniqueEmail() });
      for (let i = 1; i <= 10; i++) {
        await DB.posts.create({ title: `Post ${i}`, authorId: user.id, published: true });
      }

      const result = await new Post()
        .published()
        .order({ id: 'asc' })
        .paginate(1, 3);

      expect(result.data).toHaveLength(3);
      expect(result.meta.total).toBe(10);
      expect(result.meta.lastPage).toBe(4);
    });

    it('custom methods work with include', async () => {
      const user = await createUser({ name: 'Author Name', email: uniqueEmail() });
      await DB.posts.create({ title: 'Test Post', authorId: user.id, published: true });

      const posts = await new Post()
        .published()
        .include('author')
        .findMany();

      expect(posts).toHaveLength(1);
      expect(posts[0].author).toBeDefined();
      expect(posts[0].author.name).toBe('Author Name');
    });
  });

  // ==================== EDGE CASES ====================
  describe('Edge cases', () => {
    it('returns empty array when no matches', async () => {
      const posts = await new Post().published().findMany();
      expect(posts).toEqual([]);
    });

    it('returns null for findFirst when no matches', async () => {
      const post = await new Post().drafts().findFirst();
      expect(post).toBeNull();
    });

    it('count returns 0 when no matches', async () => {
      const count = await new Post().published().count();
      expect(count).toBe(0);
    });

    it('exists returns false when no matches', async () => {
      const exists = await new Post().published().exists();
      expect(exists).toBe(false);
    });

    it('custom methods handle special characters in search', async () => {
      const user = await createUser({ name: "Test's User", email: uniqueEmail() });
      await DB.posts.create({ title: "It's a test", authorId: user.id });

      const users = await new User().withName("'s").findMany();
      expect(users).toHaveLength(1);

      const posts = await new Post().withTitle("'s").findMany();
      expect(posts).toHaveLength(1);
    });
  });
});
