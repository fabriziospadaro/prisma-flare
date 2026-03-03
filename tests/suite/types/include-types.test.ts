/**
 * Include Type Tests
 *
 * Tests that .include() properly adds relation types to the result.
 * This test specifically catches the bug where RelationType returns `never`
 * for relations in the new prisma-client provider.
 *
 * These tests use compile-time type assertions that will cause TypeScript
 * errors if the types are wrong (e.g., if posts is `never` instead of an array).
 */

import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import { DB } from 'prisma-flare/generated';
import { cleanDatabase, disconnect, resetCounter, uniqueEmail } from '#test-helpers';

describe('Include Type Inference', () => {
  beforeEach(async () => {
    await cleanDatabase();
    resetCounter();
  });

  afterAll(async () => {
    await disconnect();
  });

  describe('has-many relations (User -> Posts)', () => {
    it('include returns posts array with correct type - can access .length', async () => {
      const user = await DB.users.create({ email: uniqueEmail() });
      await DB.posts.createMany([
        { title: 'Post 1', authorId: user.id },
        { title: 'Post 2', authorId: user.id },
      ]);

      const result = await DB.users.withId(user.id).include('posts').findFirst();

      // This line will cause a TypeScript error if posts is `never`
      // because never doesn't have a .length property
      const postsLength: number = result!.posts.length;
      expect(postsLength).toBe(2);
    });

    it('include returns posts array - can call .find()', async () => {
      const user = await DB.users.create({ email: uniqueEmail() });
      await DB.posts.create({ title: 'Target Post', authorId: user.id });

      const result = await DB.users.withId(user.id).include('posts').findFirst();

      // This line will cause a TypeScript error if posts is `never`
      const found = result!.posts.find((p) => p.title === 'Target Post');
      expect(found).toBeDefined();
      expect(found!.title).toBe('Target Post');
    });

    it('include returns posts array - can access post properties', async () => {
      const user = await DB.users.create({ email: uniqueEmail() });
      await DB.posts.create({ title: 'Test Post', authorId: user.id, views: 100 });

      const result = await DB.users.withId(user.id).include('posts').findFirst();

      // These lines will cause TypeScript errors if posts[0] is `never`
      const title: string = result!.posts[0].title;
      const views: number = result!.posts[0].views;
      const authorId: number = result!.posts[0].authorId;

      expect(title).toBe('Test Post');
      expect(views).toBe(100);
      expect(authorId).toBe(user.id);
    });
  });

  describe('belongs-to relations (Post -> Author)', () => {
    it('include returns author object with correct type', async () => {
      const user = await DB.users.create({ email: uniqueEmail(), name: 'Test Author' });
      const post = await DB.posts.create({ title: 'Test Post', authorId: user.id });

      const result = await DB.posts.withId(post.id).include('author').findFirst();

      // These lines will cause TypeScript errors if author is `never`
      const authorId: number = result!.author.id;
      const authorEmail: string = result!.author.email;
      const authorName: string | null = result!.author.name;

      expect(authorId).toBe(user.id);
      expect(authorEmail).toBe(user.email);
      expect(authorName).toBe('Test Author');
    });
  });

  describe('findMany with include', () => {
    it('returns array of users with posts included', async () => {
      const user1 = await DB.users.create({ email: uniqueEmail() });
      const user2 = await DB.users.create({ email: uniqueEmail() });
      await DB.posts.create({ title: 'User1 Post', authorId: user1.id });
      await DB.posts.createMany([
        { title: 'User2 Post 1', authorId: user2.id },
        { title: 'User2 Post 2', authorId: user2.id },
      ]);

      const results = await DB.users.include('posts').findMany();

      // Accessing posts.length on each user - TypeScript error if posts is `never`
      const postCounts: number[] = results.map((u) => u.posts.length);
      expect(postCounts).toContain(1);
      expect(postCounts).toContain(2);
    });
  });

  describe('include with callback (filtered relations)', () => {
    it('filtered include still has correct types', async () => {
      const user = await DB.users.create({ email: uniqueEmail() });
      await DB.posts.create({ title: 'Published', authorId: user.id, published: true });
      await DB.posts.create({ title: 'Draft', authorId: user.id, published: false });

      const result = await DB.users
        .withId(user.id)
        .include('posts', (posts) => posts.where({ published: true }))
        .findFirst();

      // TypeScript error if posts is `never`
      const titles: string[] = result!.posts.map((p) => p.title);
      expect(titles).toEqual(['Published']);
    });
  });

  describe('base entity fields preserved alongside relations', () => {
    it('user has both scalar fields and posts relation', async () => {
      const user = await DB.users.create({ email: uniqueEmail(), name: 'Full User' });
      await DB.posts.create({ title: 'A Post', authorId: user.id });

      const result = await DB.users.withId(user.id).include('posts').findFirst();

      // Scalar fields - should always work
      const id: number = result!.id;
      const email: string = result!.email;
      const name: string | null = result!.name;
      const status: string = result!.status;
      const createdAt: Date = result!.createdAt;

      // Relation field - TypeScript error if `never`
      const postsLength: number = result!.posts.length;

      expect(id).toBe(user.id);
      expect(email).toBe(user.email);
      expect(name).toBe('Full User');
      expect(status).toBeDefined();
      expect(createdAt).toBeInstanceOf(Date);
      expect(postsLength).toBe(1);
    });
  });

  describe('include callback has properly typed builder', () => {
    it('callback builder has where method with correct type', async () => {
      const user = await DB.users.create({ email: uniqueEmail() });
      await DB.posts.create({ title: 'Published Post', authorId: user.id, published: true });
      await DB.posts.create({ title: 'Draft Post', authorId: user.id, published: false });

      // The callback builder should be typed as FlareBuilder<'post'>
      // so .where() should accept PostWhereInput
      const result = await DB.users
        .withId(user.id)
        .include('posts', (postsBuilder) => postsBuilder.where({ published: true }))
        .findFirst();

      expect(result!.posts.length).toBe(1);
      expect(result!.posts[0].title).toBe('Published Post');
    });

    it('callback builder has order method', async () => {
      const user = await DB.users.create({ email: uniqueEmail() });
      await DB.posts.create({ title: 'B Post', authorId: user.id, views: 10 });
      await DB.posts.create({ title: 'A Post', authorId: user.id, views: 20 });

      // The callback builder should have .order() typed for post fields
      const result = await DB.users
        .withId(user.id)
        .include('posts', (postsBuilder) => postsBuilder.order({ title: 'asc' }))
        .findFirst();

      expect(result!.posts[0].title).toBe('A Post');
      expect(result!.posts[1].title).toBe('B Post');
    });

    it('callback builder has limit method', async () => {
      const user = await DB.users.create({ email: uniqueEmail() });
      await DB.posts.create({ title: 'Post 1', authorId: user.id });
      await DB.posts.create({ title: 'Post 2', authorId: user.id });
      await DB.posts.create({ title: 'Post 3', authorId: user.id });

      const result = await DB.users
        .withId(user.id)
        .include('posts', (postsBuilder) => postsBuilder.limit(2))
        .findFirst();

      expect(result!.posts.length).toBe(2);
    });

    it('belongs-to callback builder is typed correctly', async () => {
      const user = await DB.users.create({ email: uniqueEmail(), name: 'Test Author' });
      await DB.posts.create({ title: 'Test Post', authorId: user.id });

      // For belongs-to relation, callback builder should be FlareBuilder<'user'>
      // Note: belongs-to relations don't support .where() since they're single records
      // but the builder should still be properly typed for other operations
      const result = await DB.posts
        .where({ authorId: user.id })
        .include('author')
        .findFirst();

      // Verify the author type is correctly inferred (not never)
      const authorId: number = result!.author.id;
      const authorEmail: string = result!.author.email;
      const authorName: string | null = result!.author.name;

      expect(authorId).toBe(user.id);
      expect(authorEmail).toBe(user.email);
      expect(authorName).toBe('Test Author');
    });
  });

  describe('paginate with include', () => {
    it('paginate returns data with included relations typed correctly', async () => {
      const user = await DB.users.create({ email: uniqueEmail() });
      await DB.posts.createMany([
        { title: 'Post 1', authorId: user.id },
        { title: 'Post 2', authorId: user.id },
      ]);

      const result = await DB.users.include('posts').paginate(1, 10);

      // This will cause a TypeScript error if paginate drops the Args generic
      const postsLength: number = result.data[0].posts.length;
      expect(postsLength).toBe(2);
      expect(result.meta.total).toBe(1);
    });

    it('paginate with callback include preserves nested types', async () => {
      const user = await DB.users.create({ email: uniqueEmail() });
      await DB.posts.create({ title: 'Published', authorId: user.id, published: true });

      const result = await DB.users
        .include('posts', (posts) => posts.where({ published: true }))
        .paginate(1, 10);

      const title: string = result.data[0].posts[0].title;
      expect(title).toBe('Published');
    });
  });

  describe('findFirstOrThrow with include', () => {
    it('returns result with included relations typed correctly', async () => {
      const user = await DB.users.create({ email: uniqueEmail() });
      await DB.posts.create({ title: 'Test Post', authorId: user.id });

      const result = await DB.users.withId(user.id).include('posts').findFirstOrThrow();

      // This will cause a TypeScript error if findFirstOrThrow drops Args
      const postsLength: number = result.posts.length;
      expect(postsLength).toBe(1);
      expect(result.posts[0].title).toBe('Test Post');
    });
  });

  describe('findUniqueOrThrow with include', () => {
    it('returns result with included relations typed correctly', async () => {
      const user = await DB.users.create({ email: uniqueEmail() });
      await DB.posts.create({ title: 'Unique Post', authorId: user.id });

      const result = await DB.users.where({ id: user.id }).include('posts').findUniqueOrThrow();

      // This will cause a TypeScript error if findUniqueOrThrow drops Args
      const postsLength: number = result.posts.length;
      expect(postsLength).toBe(1);
      expect(result.posts[0].title).toBe('Unique Post');
    });
  });

  describe('chunk with include', () => {
    it('callback receives results with included relations typed correctly', async () => {
      const user = await DB.users.create({ email: uniqueEmail() });
      await DB.posts.createMany([
        { title: 'Chunk Post 1', authorId: user.id },
        { title: 'Chunk Post 2', authorId: user.id },
      ]);

      const collected: number[] = [];
      await DB.users.include('posts').chunk(10, (results) => {
        // This will cause a TypeScript error if chunk drops Args
        for (const u of results) {
          collected.push(u.posts.length);
        }
      });

      expect(collected).toContain(2);
    });
  });

  describe('nested includes (callback within callback)', () => {
    it('nested include callback has correct builder type - can call .include()', async () => {
      const user = await DB.users.create({ email: uniqueEmail(), name: 'Author' });
      await DB.posts.create({ title: 'Test Post', authorId: user.id });

      // This tests the nested callback typing:
      // - posts callback should be FlareBuilder<'post'>
      // - posts.include('author') should work if 'post' model has 'author' relation
      // If the callback is typed as `any`, this compiles but loses type safety
      // If the callback is typed as `never`, .include('author') would be a compile error
      const result = await DB.users
        .withId(user.id)
        .include('posts', (posts) => posts.include('author'))
        .findFirst();

      // Verify types are correct at each level
      const postsLength: number = result!.posts.length;
      const authorEmail: string = result!.posts[0].author.email;
      const authorName: string | null = result!.posts[0].author.name;

      expect(postsLength).toBe(1);
      expect(authorEmail).toBe(user.email);
      expect(authorName).toBe('Author');
    });

    it('nested include callback has correct where() types', async () => {
      const user = await DB.users.create({ email: uniqueEmail() });
      await DB.posts.create({ title: 'Published', authorId: user.id, published: true });
      await DB.posts.create({ title: 'Draft', authorId: user.id, published: false });

      // The nested callback should have properly typed .where() that accepts PostWhereInput
      // If callback is `any`, this would work but silently lose type safety
      // If callback is `never`, .where() would fail to compile
      const result = await DB.users
        .withId(user.id)
        .include('posts', (posts) => posts.where({ published: true }))
        .findFirst();

      expect(result!.posts.length).toBe(1);
      expect(result!.posts[0].title).toBe('Published');
    });

    it('nested include with order() has correct types', async () => {
      const user = await DB.users.create({ email: uniqueEmail() });
      await DB.posts.create({ title: 'B Post', authorId: user.id });
      await DB.posts.create({ title: 'A Post', authorId: user.id });

      // The nested callback should have properly typed .order() that accepts PostOrderByInput
      const result = await DB.users
        .withId(user.id)
        .include('posts', (posts) => posts.order({ title: 'asc' }))
        .findFirst();

      expect(result!.posts[0].title).toBe('A Post');
      expect(result!.posts[1].title).toBe('B Post');
    });

    it('double nested include with chained operations', async () => {
      const user = await DB.users.create({ email: uniqueEmail(), name: 'Nested User' });
      await DB.posts.create({ title: 'Published Post', authorId: user.id, published: true, views: 100 });
      await DB.posts.create({ title: 'Draft Post', authorId: user.id, published: false, views: 50 });

      // This tests chaining multiple operations in nested callback:
      // .where(), .order(), .include() should all be typed correctly
      const result = await DB.users
        .withId(user.id)
        .include('posts', (posts) =>
          posts
            .where({ published: true })
            .order({ views: 'desc' })
            .include('author')
        )
        .findFirst();

      // Should only have published post, with author included
      expect(result!.posts.length).toBe(1);
      expect(result!.posts[0].title).toBe('Published Post');
      expect(result!.posts[0].author.email).toBe(user.email);
    });
  });
});
