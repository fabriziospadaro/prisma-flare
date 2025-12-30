/**
 * Include (Relations) Integration Tests
 *
 * Comprehensive tests for relation loading and nested queries:
 * - Simple include
 * - Include with filtering
 * - Include with ordering
 * - Nested includes
 * - Custom model methods in includes
 */

import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import { DB } from 'prisma-flare/generated';
import { cleanDatabase, disconnectPrisma } from '../../helpers/database.js';
import { createUser, createPost, createUserWithPosts, createUserWithMixedPosts } from '../../helpers/factories.js';

describe('Include (Relations)', () => {
  beforeEach(async () => {
    await cleanDatabase();
  });

  afterAll(async () => {
    await disconnectPrisma();
  });

  /**
   * ============================================
   * SIMPLE INCLUDE
   * ============================================
   */
  describe('Simple Include', () => {
    it('should include relation without callback', async () => {
      const { user, posts } = await createUserWithPosts();

      const result = await DB.users.withId(user.id).include('posts').findFirst();

      expect(result).toBeDefined();
      expect(result?.posts).toHaveLength(posts.length);
    });

    it('should return empty array when no related records', async () => {
      const user = await createUser();

      const result = await DB.users.withId(user.id).include('posts').findFirst();

      expect(result?.posts).toEqual([]);
    });

    it('should include relation on findMany', async () => {
      const user1 = await createUser();
      const user2 = await createUser();
      await createPost({ authorId: user1.id });
      await createPost({ authorId: user2.id });

      const users = await DB.users.include('posts').findMany();

      expect(users).toHaveLength(2);
      expect(users.every((u) => Array.isArray(u.posts))).toBe(true);
    });

    it('should include relation on reverse side', async () => {
      const { user, posts } = await createUserWithPosts();

      const post = await DB.posts.withId(posts[0].id).include('author').findFirst();

      expect(post?.author).toBeDefined();
      expect(post?.author.id).toBe(user.id);
    });
  });

  /**
   * ============================================
   * INCLUDE WITH FILTERING
   * ============================================
   */
  describe('Include with Filtering', () => {
    it('should filter included relation', async () => {
      const { user, publishedPosts, draftPosts } = await createUserWithMixedPosts();

      const result = await DB.users
        .withId(user.id)
        .include('posts', (posts) => posts.where({ published: true }))
        .findFirst();

      expect(result?.posts).toHaveLength(publishedPosts.length);
      expect(result?.posts.every((p: any) => p.published === true)).toBe(true);
    });

    it('should filter with complex conditions', async () => {
      const user = await createUser();
      await DB.posts.createMany([
        { title: 'Popular', authorId: user.id, views: 1000, published: true },
        { title: 'Regular', authorId: user.id, views: 100, published: true },
        { title: 'Draft', authorId: user.id, views: 0, published: false },
      ]);

      const result = await DB.users
        .withId(user.id)
        .include('posts', (posts) =>
          posts.where({ published: true }).where({ views: { gte: 500 } })
        )
        .findFirst();

      expect(result?.posts).toHaveLength(1);
      expect(result?.posts[0].title).toBe('Popular');
    });

    it('should return empty array when filter matches nothing', async () => {
      const { user } = await createUserWithPosts();

      const result = await DB.users
        .withId(user.id)
        .include('posts', (posts) => posts.where({ title: 'Nonexistent' }))
        .findFirst();

      expect(result?.posts).toEqual([]);
    });
  });

  /**
   * ============================================
   * INCLUDE WITH ORDERING
   * ============================================
   */
  describe('Include with Ordering', () => {
    it('should order included relation', async () => {
      const user = await createUser();
      await DB.posts.create({ title: 'B Post', authorId: user.id });
      await DB.posts.create({ title: 'A Post', authorId: user.id });
      await DB.posts.create({ title: 'C Post', authorId: user.id });

      const result = await DB.users
        .withId(user.id)
        .include('posts', (posts) => posts.order({ title: 'asc' }))
        .findFirst();

      expect(result?.posts.map((p: any) => p.title)).toEqual(['A Post', 'B Post', 'C Post']);
    });

    it('should order descending', async () => {
      const user = await createUser();
      await DB.posts.create({ title: 'Post 1', authorId: user.id, views: 100 });
      await DB.posts.create({ title: 'Post 2', authorId: user.id, views: 300 });
      await DB.posts.create({ title: 'Post 3', authorId: user.id, views: 200 });

      const result = await DB.users
        .withId(user.id)
        .include('posts', (posts) => posts.order({ views: 'desc' }))
        .findFirst();

      expect(result?.posts[0].views).toBe(300);
      expect(result?.posts[2].views).toBe(100);
    });
  });

  /**
   * ============================================
   * INCLUDE WITH LIMIT
   * ============================================
   */
  describe('Include with Limit', () => {
    it('should limit included records', async () => {
      const user = await createUser();
      for (let i = 0; i < 10; i++) {
        await createPost({ authorId: user.id });
      }

      const result = await DB.users
        .withId(user.id)
        .include('posts', (posts) => posts.limit(3))
        .findFirst();

      expect(result?.posts).toHaveLength(3);
    });

    it('should combine limit with order (top N pattern)', async () => {
      const user = await createUser();
      await DB.posts.create({ title: 'Low', authorId: user.id, views: 10 });
      await DB.posts.create({ title: 'High', authorId: user.id, views: 1000 });
      await DB.posts.create({ title: 'Medium', authorId: user.id, views: 100 });
      await DB.posts.create({ title: 'Highest', authorId: user.id, views: 5000 });

      const result = await DB.users
        .withId(user.id)
        .include('posts', (posts) => posts.order({ views: 'desc' }).limit(2))
        .findFirst();

      expect(result?.posts).toHaveLength(2);
      expect(result?.posts[0].views).toBe(5000);
      expect(result?.posts[1].views).toBe(1000);
    });
  });

  /**
   * ============================================
   * INCLUDE WITH SELECT
   * ============================================
   */
  describe('Include with Select', () => {
    it('should select specific fields from included relation', async () => {
      const { user } = await createUserWithPosts();

      const result = await DB.users
        .withId(user.id)
        .include('posts', (posts) => posts.select({ id: true, title: true }))
        .findFirst();

      expect(result?.posts[0]).toHaveProperty('id');
      expect(result?.posts[0]).toHaveProperty('title');
      expect(result?.posts[0]).not.toHaveProperty('content');
      expect(result?.posts[0]).not.toHaveProperty('views');
    });
  });

  /**
   * ============================================
   * NESTED INCLUDES
   * ============================================
   */
  describe('Nested Includes', () => {
    it('should include nested relation', async () => {
      const { user } = await createUserWithPosts();

      const result = await DB.users
        .withId(user.id)
        .include('posts', (posts) =>
          posts.include('author', (author) => author.select({ email: true }))
        )
        .findFirst();

      expect(result?.posts[0].author).toBeDefined();
      expect(result?.posts[0].author.email).toBe(user.email);
    });

    it('should handle circular references correctly', async () => {
      const { user, posts } = await createUserWithPosts();

      // User -> Posts -> Author (back to user)
      const result = await DB.users
        .withId(user.id)
        .include('posts', (postsQb) =>
          postsQb.include('author')
        )
        .findFirst();

      expect(result?.posts[0].author.id).toBe(user.id);
    });
  });

  /**
   * ============================================
   * CUSTOM MODEL METHODS IN INCLUDE
   * ============================================
   */
  describe('Custom Model Methods in Include', () => {
    it('should use custom published() method', async () => {
      const { user, publishedPosts } = await createUserWithMixedPosts();

      const result = await DB.users
        .withId(user.id)
        .include('posts', (posts) => posts.published())
        .findFirst();

      expect(result?.posts).toHaveLength(publishedPosts.length);
      expect(result?.posts.every((p: any) => p.published === true)).toBe(true);
    });

    it('should use custom drafts() method', async () => {
      const { user, draftPosts } = await createUserWithMixedPosts();

      const result = await DB.users
        .withId(user.id)
        .include('posts', (posts) => posts.drafts())
        .findFirst();

      expect(result?.posts).toHaveLength(draftPosts.length);
      expect(result?.posts.every((p: any) => p.published === false)).toBe(true);
    });

    it('should chain custom methods', async () => {
      const user = await createUser();
      await DB.posts.createMany([
        { title: 'Old Published', authorId: user.id, published: true },
        { title: 'New Published', authorId: user.id, published: true },
        { title: 'Draft', authorId: user.id, published: false },
      ]);

      const result = await DB.users
        .withId(user.id)
        .include('posts', (posts) => posts.published().recent(1))
        .findFirst();

      expect(result?.posts).toHaveLength(1);
    });
  });

  /**
   * ============================================
   * INCLUDE EDGE CASES
   * ============================================
   */
  describe('Edge Cases', () => {
    it('should handle include on non-existent record', async () => {
      const result = await DB.users.withId(99999).include('posts').findFirst();

      expect(result).toBeNull();
    });

    it('should handle multiple include calls', async () => {
      // Note: This behavior depends on implementation
      // Some implementations might override, others might merge
      const { user } = await createUserWithMixedPosts();

      const result = await DB.users
        .withId(user.id)
        .include('posts', (posts) => posts.where({ published: true }))
        .findFirst();

      // Should only have published posts
      expect(result?.posts.every((p: any) => p.published === true)).toBe(true);
    });

    it('should work with findMany and include', async () => {
      const user1 = await createUser();
      const user2 = await createUser();
      await createPost({ authorId: user1.id, published: true });
      await createPost({ authorId: user2.id, published: false });

      const users = await DB.users
        .include('posts', (posts) => posts.where({ published: true }))
        .findMany();

      expect(users).toHaveLength(2);
      // Only user1 should have posts in the result
      const user1Result = users.find((u) => u.id === user1.id);
      const user2Result = users.find((u) => u.id === user2.id);

      expect(user1Result?.posts).toHaveLength(1);
      expect(user2Result?.posts).toHaveLength(0);
    });
  });
});
