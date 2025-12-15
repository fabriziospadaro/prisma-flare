
import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import { DB } from 'prisma-flare/generated';
import { cleanDatabase, disconnectPrisma } from './helpers.js';

describe('FlareBuilder Include Tests', () => {
  beforeEach(async () => {
    await cleanDatabase();
  });

  afterAll(async () => {
    await disconnectPrisma();
  });

  it('should include relations using with()', async () => {
    const user = await DB.users.create({
      email: 'user@example.com',
      name: 'User',
    });

    await DB.posts.createMany([
      { title: 'Post 1', content: 'Content 1', authorId: user.id, published: true },
      { title: 'Post 2', content: 'Content 2', authorId: user.id, published: false },
    ]);

    const userWithPosts = await DB.users
      .withId(user.id)
      .include('posts', (q) => q.where({ published: true }))
      .findFirst();

    expect(userWithPosts).toBeDefined();
    expect(userWithPosts?.posts).toBeDefined();
    expect(userWithPosts?.posts).toHaveLength(1);
    expect(userWithPosts?.posts[0].title).toBe('Post 1');
  });

  it('should include nested relations using with()', async () => {
    // Setup: User -> Post
    // We don't have a deeper relation in the schema provided (User -> Post), 
    // but we can test chaining multiple .with() on the same level or nested if schema supported it.
    // Let's test multiple .with() on same level if possible, but User only has posts.
    // Let's try to include posts and order them.

    const user = await DB.users.create({
      email: 'user2@example.com',
      name: 'User 2',
    });

    await DB.posts.createMany([
      { title: 'A Post', content: 'Content A', authorId: user.id, published: true },
      { title: 'B Post', content: 'Content B', authorId: user.id, published: true },
    ]);

    const userWithPosts = await DB.users
      .withId(user.id)
      .include('posts', (q) => q.order({ title: 'desc' }))
      .findFirst();

    expect(userWithPosts).toBeDefined();
    expect(userWithPosts?.posts).toHaveLength(2);
    expect(userWithPosts?.posts[0].title).toBe('B Post');
    expect(userWithPosts?.posts[1].title).toBe('A Post');
  });

  it('should support simple include without callback', async () => {
    const user = await DB.users.create({
      email: 'user3@example.com',
      name: 'User 3',
    });

    await DB.posts.create({ title: 'Post', authorId: user.id });

    const userWithPosts = await DB.users
      .withId(user.id)
      .include('posts')
      .findFirst();

    expect(userWithPosts).toBeDefined();
    expect(userWithPosts?.posts).toHaveLength(1);
  });

  it('should support nested with()', async () => {
    const user = await DB.users.create({
      email: 'nested@example.com',
      name: 'Nested User',
    });

    await DB.posts.create({ title: 'Nested Post', authorId: user.id });

    const userWithPostsAndAuthor = await DB.users
      .withId(user.id)
      .include("posts", (posts) => posts
        .include("author", (author) => author.select({ email: true }))
      )
      .findFirst();

    expect(userWithPostsAndAuthor).toBeDefined();
    expect(userWithPostsAndAuthor).toBeDefined();
    expect(userWithPostsAndAuthor?.posts[0].author.email).toBe('nested@example.com');
  });
});
