import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import { DB } from 'prisma-flare/generated';
import { cleanDatabase, disconnectPrisma } from './helpers.js';

describe('Custom Queries Integration Tests', () => {
  beforeEach(async () => {
    await cleanDatabase();
  });

  afterAll(async () => {
    await disconnectPrisma();
  });

  describe('UserQuery', () => {
    it('should chain custom methods with standard methods', async () => {
      // Create test users
      await DB.users.createMany([
        { email: 'alice@example.com', name: 'Alice Wonderland' },
        { email: 'bob@example.com', name: 'Bob Builder' },
        { email: 'charlie@example.com', name: 'Charlie Chocolate' },
      ]);

      // Test chaining: withName + order + limit
      const users = await DB.users
        .withName('Alice')
        .order({ name: 'asc' })
        .limit(1)
        .findMany();

      expect(users).toHaveLength(1);
      expect(users[0].email).toBe('alice@example.com');
    });

    it('should use withEmail custom method', async () => {
      await DB.users.create({
        email: 'target@example.com',
        name: 'Target',
      });

      const user = await DB.users
        .withEmail('target@example.com')
        .findFirst();

      expect(user).toBeDefined();
      expect(user?.name).toBe('Target');
    });

    it('should use createdAfter custom method', async () => {
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);

      await DB.users.create({
        email: 'new@example.com',
        name: 'New User',
      });

      const users = await DB.users
        .createdAfter(yesterday)
        .findMany();

      expect(users.length).toBeGreaterThan(0);
    });
  });

  describe('PostQuery', () => {
    it('should chain custom methods for posts', async () => {
      // Create user and posts
      const user = await DB.users.create({
        email: 'author@example.com',
        name: 'Author',
      });

      await DB.posts.createMany([
        { title: 'First Post', published: true, authorId: user.id },
        { title: 'Draft Post', published: false, authorId: user.id },
        { title: 'Another Published', published: true, authorId: user.id },
      ]);

      // Test chaining: published + withTitle
      const publishedPosts = await DB.posts
        .published()
        .withTitle('First')
        .findMany();

      expect(publishedPosts).toHaveLength(1);
      expect(publishedPosts[0].title).toBe('First Post');

      // Test chaining: drafts
      const drafts = await DB.posts
        .drafts()
        .withAuthorId(user.id)
        .findMany();

      expect(drafts).toHaveLength(1);
      expect(drafts[0].title).toBe('Draft Post');
    });

    it('should use recent custom method', async () => {
      const user = await DB.users.create({
        email: 'recent@example.com',
        name: 'Recent',
      });

      await DB.posts.create({
        title: 'Recent Post',
        published: true,
        authorId: user.id
      });

      const posts = await DB.posts
        .recent(1)
        .findMany();

      expect(posts.length).toBeGreaterThan(0);
      expect(posts[0].title).toBe('Recent Post');
    });
  });
});
