/**
 * Tests for new prisma-client provider support
 *
 * This test file verifies that prisma-flare works correctly when users
 * use the new "prisma-client" provider (instead of "prisma-client-js")
 * with a custom output path.
 *
 * The new prisma-client provider offers:
 * - Better ESM module support
 * - More consistent behavior across different Node.js runtimes
 */
import { describe, it, expect, beforeEach, afterAll, vi } from 'vitest';
import { beforeCreate, afterCreate, hookRegistry, FlareBuilder } from 'prisma-flare';
import { DB } from 'prisma-flare/generated';
import { db } from '../prisma/db';

describe('New prisma-client Provider Support', () => {
  beforeEach(async () => {
    // Clean database
    await db.post.deleteMany({});
    await db.user.deleteMany({});
    // Clear hooks
    hookRegistry.clearAll();
  });

  afterAll(async () => {
    await db.$disconnect();
  });

  describe('FlareClient with prisma-client provider', () => {
    it('should create FlareClient instance', () => {
      expect(db).toBeDefined();
      expect(typeof db.user).toBe('object');
      expect(typeof db.post).toBe('object');
    });

    it('should support basic CRUD operations', async () => {
      // Create
      const user = await db.user.create({
        data: { email: 'test@example.com', name: 'Test User' }
      });
      expect(user.id).toBeDefined();
      expect(user.email).toBe('test@example.com');

      // Read
      const found = await db.user.findUnique({ where: { id: user.id } });
      expect(found?.email).toBe('test@example.com');

      // Update
      const updated = await db.user.update({
        where: { id: user.id },
        data: { name: 'Updated Name' }
      });
      expect(updated.name).toBe('Updated Name');

      // Delete
      await db.user.delete({ where: { id: user.id } });
      const deleted = await db.user.findUnique({ where: { id: user.id } });
      expect(deleted).toBeNull();
    });
  });

  describe('FlareBuilder with prisma-client provider', () => {
    it('should support from() method', async () => {
      await db.user.create({
        data: { email: 'builder@example.com', name: 'Builder User' }
      });

      const users = await db.from('user').where({ email: 'builder@example.com' }).findMany();
      expect(users).toHaveLength(1);
      expect(users[0].email).toBe('builder@example.com');
    });

    it('should support chained queries', async () => {
      await db.user.createMany({
        data: [
          { email: 'user1@example.com', name: 'User 1' },
          { email: 'user2@example.com', name: 'User 2' },
          { email: 'user3@example.com', name: 'User 3' }
        ]
      });

      const users = await db
        .from('user')
        .where({ name: { contains: 'User' } })
        .order({ email: 'asc' })
        .limit(2)
        .findMany();

      expect(users).toHaveLength(2);
      expect(users[0].email).toBe('user1@example.com');
    });
  });

  describe('Hooks with prisma-client provider', () => {
    it('should support beforeCreate hooks', async () => {
      const callback = vi.fn();
      beforeCreate('user', callback);

      await db.user.create({
        data: { email: 'hook@example.com', name: 'Hook User' }
      });

      expect(callback).toHaveBeenCalled();
    });

    it('should support afterCreate hooks', async () => {
      const callback = vi.fn();
      afterCreate('user', callback);

      const user = await db.user.create({
        data: { email: 'after@example.com', name: 'After User' }
      });

      expect(callback).toHaveBeenCalled();
      expect(callback).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ email: 'after@example.com' })
        }),
        expect.objectContaining({ id: user.id }),
        expect.anything()
      );
    });

    it('should block creation if before hook throws', async () => {
      beforeCreate('user', () => {
        throw new Error('Validation failed');
      });

      await expect(
        db.user.create({
          data: { email: 'fail@example.com', name: 'Fail User' }
        })
      ).rejects.toThrow('Validation failed');

      // Verify user was NOT created
      const user = await db.user.findFirst({ where: { email: 'fail@example.com' } });
      expect(user).toBeNull();
    });
  });

  describe('Transactions with prisma-client provider', () => {
    it('should support transactions with from() method', async () => {
      await db.transaction(async (tx) => {
        const user = await tx.user.create({
          data: { email: 'tx@example.com', name: 'TX User' }
        });

        await tx.post.create({
          data: {
            title: 'TX Post',
            authorId: user.id
          }
        });

        // Use from() in transaction
        const posts = await tx.from('post').where({ authorId: user.id }).findMany();
        expect(posts).toHaveLength(1);
      });

      // Verify data persisted
      const user = await db.user.findFirst({ where: { email: 'tx@example.com' } });
      expect(user).not.toBeNull();
    });
  });

  describe('Relations with prisma-client provider', () => {
    it('should support include with relations', async () => {
      const user = await db.user.create({
        data: {
          email: 'relations@example.com',
          name: 'Relations User',
          posts: {
            create: [
              { title: 'Post 1' },
              { title: 'Post 2' }
            ]
          }
        },
        include: { posts: true }
      });

      expect(user.posts).toHaveLength(2);
    });

    it('should support FlareBuilder include', async () => {
      await db.user.create({
        data: {
          email: 'flare-rel@example.com',
          name: 'Flare Relations User',
          posts: {
            create: [{ title: 'Flare Post' }]
          }
        }
      });

      const users = await db
        .from('user')
        .where({ email: 'flare-rel@example.com' })
        .include('posts')
        .findMany();

      expect(users[0].posts).toHaveLength(1);
      expect(users[0].posts[0].title).toBe('Flare Post');
    });
  });

  describe('DB.models pattern with prisma-client provider', () => {
    it('should access DB.users', () => {
      expect(DB.users).toBeDefined();
      expect(typeof DB.users.where).toBe('function');
      expect(typeof DB.users.findMany).toBe('function');
    });

    it('should access DB.posts', () => {
      expect(DB.posts).toBeDefined();
      expect(typeof DB.posts.where).toBe('function');
      expect(typeof DB.posts.findMany).toBe('function');
    });

    it('should create a user with DB.users', async () => {
      const user = await DB.users.create({
        email: 'db-users@example.com',
        name: 'DB Users Test',
      });

      expect(user).toBeDefined();
      expect(user.email).toBe('db-users@example.com');
      expect(user.name).toBe('DB Users Test');
    });

    it('should query users with DB.users.where', async () => {
      await DB.users.create({
        email: 'query-test@example.com',
        name: 'Query Test User',
      });

      const users = await DB.users
        .where({ email: 'query-test@example.com' })
        .findMany();

      expect(users).toHaveLength(1);
      expect(users[0].name).toBe('Query Test User');
    });

    it('should create posts with DB.posts', async () => {
      const user = await DB.users.create({
        email: 'author@example.com',
        name: 'Author',
      });

      const post = await DB.posts.create({
        title: 'Test Post',
        authorId: user.id,
      });

      expect(post).toBeDefined();
      expect(post.title).toBe('Test Post');
      expect(post.authorId).toBe(user.id);
    });

    it('should support chained queries with DB.users', async () => {
      await DB.users.createMany([
        { email: 'user1@db.com', name: 'User 1' },
        { email: 'user2@db.com', name: 'User 2' },
        { email: 'user3@db.com', name: 'User 3' },
      ]);

      const users = await DB.users
        .where({ email: { contains: '@db.com' } })
        .order({ email: 'asc' })
        .limit(2)
        .findMany();

      expect(users).toHaveLength(2);
      expect(users[0].email).toBe('user1@db.com');
    });

    it('should support include with DB.users', async () => {
      await DB.users.create({
        email: 'include-test@example.com',
        name: 'Include Test',
      });

      const user = await DB.users.where({ email: 'include-test@example.com' }).findFirst();
      if (user) {
        await DB.posts.create({
          title: 'Included Post',
          authorId: user.id,
        });
      }

      const usersWithPosts = await DB.users
        .where({ email: 'include-test@example.com' })
        .include('posts')
        .findMany();

      expect(usersWithPosts[0].posts).toHaveLength(1);
      expect(usersWithPosts[0].posts[0].title).toBe('Included Post');
    });
  });
});
