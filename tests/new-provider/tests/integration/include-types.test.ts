/**
 * Type Safety Tests for .include() with prisma-client Provider
 *
 * These tests verify that when using .include(), the returned type
 * includes BOTH the base entity fields AND the included relations.
 *
 * IMPORTANT: These tests should FAIL at compile time (tsc --noEmit)
 * if the types are incorrect. The runtime tests will pass, but the
 * type checking should catch the issue.
 *
 * Bug: With prisma-client provider + custom output, .include() returns
 * only the relation fields, losing the base entity fields in the type.
 */

import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import { DB } from 'prisma-flare/generated';
import { cleanDatabase, disconnectDatabase } from '../helpers';
import { createUser, createUserWithPosts, resetCounters } from '../helpers';

describe('Include Type Safety - prisma-client Provider', () => {
  beforeEach(async () => {
    await cleanDatabase();
    resetCounters();
  });

  afterAll(async () => {
    await disconnectDatabase();
  });

  describe('Base entity fields after include()', () => {
    it('should have User.id after include("posts") - findFirst', async () => {
      const { user } = await createUserWithPosts();

      const result = await DB.users
        .withId(user.id)
        .include('posts')
        .findFirst();

      expect(result).not.toBeNull();

      // TYPE TEST: These should compile without error
      // If types are wrong, tsc will fail with "Property 'id' does not exist"
      const userId: number = result!.id;
      const userEmail: string = result!.email;
      const userName: string | null = result!.name;
      const userCreatedAt: Date = result!.createdAt;

      expect(userId).toBe(user.id);
      expect(userEmail).toBe(user.email);
      expect(userName).toBe(user.name);
      expect(userCreatedAt).toBeInstanceOf(Date);
    });

    it('should have User.id after include("posts") - findMany', async () => {
      await createUserWithPosts();

      const results = await DB.users.include('posts').findMany();

      expect(results.length).toBeGreaterThan(0);

      // TYPE TEST: Access base entity fields on array result
      const firstUser = results[0];
      const userId: number = firstUser.id;
      const userEmail: string = firstUser.email;

      expect(userId).toBeDefined();
      expect(userEmail).toBeDefined();
    });

    it('should have User.id after include("posts") - findUnique', async () => {
      const { user } = await createUserWithPosts();

      const result = await DB.users
        .withId(user.id)
        .include('posts')
        .findUnique();

      expect(result).not.toBeNull();

      // TYPE TEST: Access base entity fields
      const userId: number = result!.id;
      const userEmail: string = result!.email;

      expect(userId).toBe(user.id);
      expect(userEmail).toBe(user.email);
    });
  });

  describe('Included relation fields', () => {
    it('should have posts array with Post fields', async () => {
      const { user } = await createUserWithPosts();

      const result = await DB.users
        .withId(user.id)
        .include('posts')
        .findFirst();

      expect(result).not.toBeNull();
      expect(result!.posts).toHaveLength(2);

      // TYPE TEST: Access Post fields on included relation
      const firstPost = result!.posts[0];
      const postId: number = firstPost.id;
      const postTitle: string = firstPost.title;
      const postPublished: boolean = firstPost.published;

      expect(postId).toBeDefined();
      expect(postTitle).toBeDefined();
      expect(postPublished).toBe(false);
    });
  });

  describe('Nested includes', () => {
    it('should have Post.author with User fields after nested include', async () => {
      const { user, posts } = await createUserWithPosts();

      const result = await DB.posts
        .withId(posts[0].id)
        .include('author')
        .findFirst();

      expect(result).not.toBeNull();

      // TYPE TEST: Access base Post fields
      const postId: number = result!.id;
      const postTitle: string = result!.title;

      // TYPE TEST: Access included author (User) fields
      const authorId: number = result!.author.id;
      const authorEmail: string = result!.author.email;

      expect(postId).toBe(posts[0].id);
      expect(postTitle).toBe(posts[0].title);
      expect(authorId).toBe(user.id);
      expect(authorEmail).toBe(user.email);
    });
  });

  describe('Include with callback (filtered relations)', () => {
    it('should have base fields after include with callback', async () => {
      const user = await createUser();
      await DB.posts.create({ title: 'Published', authorId: user.id, published: true });
      await DB.posts.create({ title: 'Draft', authorId: user.id, published: false });

      const result = await DB.users
        .withId(user.id)
        .include('posts', (posts) => posts.where({ published: true }))
        .findFirst();

      expect(result).not.toBeNull();

      // TYPE TEST: Base entity fields should exist
      const userId: number = result!.id;
      const userEmail: string = result!.email;

      // TYPE TEST: Filtered posts should have Post fields
      expect(result!.posts).toHaveLength(1);
      const postTitle: string = result!.posts[0].title;

      expect(userId).toBe(user.id);
      expect(userEmail).toBe(user.email);
      expect(postTitle).toBe('Published');
    });

    it('should have base fields after include with order callback', async () => {
      const { user } = await createUserWithPosts();

      const result = await DB.users
        .withId(user.id)
        .include('posts', (posts) => posts.order({ title: 'asc' }))
        .findFirst();

      expect(result).not.toBeNull();

      // TYPE TEST: Base entity fields
      const userId: number = result!.id;
      const userName: string | null = result!.name;

      expect(userId).toBe(user.id);
      expect(userName).toBe(user.name);
    });
  });

  describe('Multiple includes (when schema supports)', () => {
    it('should preserve base fields with chained operations after include', async () => {
      await createUserWithPosts({ name: 'Alice' });
      await createUserWithPosts({ name: 'Bob' });

      const results = await DB.users
        .where({ name: { not: null } })
        .include('posts')
        .order({ name: 'asc' })
        .findMany();

      expect(results.length).toBe(2);

      // TYPE TEST: Base fields on ordered results with includes
      const firstName: string | null = results[0].name;
      const firstId: number = results[0].id;
      const firstPosts = results[0].posts;

      expect(firstName).toBe('Alice');
      expect(firstId).toBeDefined();
      expect(firstPosts).toBeDefined();
    });
  });
});
