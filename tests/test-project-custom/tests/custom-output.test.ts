/**
 * Tests for custom Prisma output path support
 *
 * This test file verifies that prisma-flare works correctly when users
 * have a custom Prisma client output path (output = "./generated/client")
 * instead of the default @prisma/client.
 */
import { describe, it, expect, beforeEach, afterAll, vi } from 'vitest';
import { beforeCreate, afterCreate, hookRegistry, FlareBuilder } from 'prisma-flare';
import { db } from '../prisma/db';

describe('Custom Prisma Output Path Support', () => {
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

  describe('FlareClient with custom output', () => {
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

  describe('FlareBuilder with custom output', () => {
    it('should support from() method', async () => {
      await db.user.create({
        data: { email: 'builder@example.com', name: 'Builder User' }
      });

      const users = await db.from('User').where({ email: 'builder@example.com' }).findMany();
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
        .from('User')
        .where({ name: { contains: 'User' } })
        .order({ email: 'asc' })
        .limit(2)
        .findMany();

      expect(users).toHaveLength(2);
      expect(users[0].email).toBe('user1@example.com');
    });
  });

  describe('Hooks with custom output', () => {
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

  describe('Transactions with custom output', () => {
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
        const posts = await tx.from('Post').where({ authorId: user.id }).findMany();
        expect(posts).toHaveLength(1);
      });

      // Verify data persisted
      const user = await db.user.findFirst({ where: { email: 'tx@example.com' } });
      expect(user).not.toBeNull();
    });
  });

  describe('Relations with custom output', () => {
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
        .from('User')
        .where({ email: 'flare-rel@example.com' })
        .include('posts')
        .findMany();

      expect(users[0].posts).toHaveLength(1);
      expect(users[0].posts[0].title).toBe('Flare Post');
    });
  });
});
