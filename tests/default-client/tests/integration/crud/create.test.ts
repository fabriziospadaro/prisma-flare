/**
 * Create Operations Integration Tests
 *
 * Comprehensive tests for all create operations:
 * - create()
 * - createMany()
 */

import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import { DB } from 'prisma-flare/generated';
import { cleanDatabase, disconnectPrisma } from '../../helpers/database.js';
import { uniqueEmail, createUser } from '../../helpers/factories.js';
import { assertRecentlyCreated } from '../../helpers/assertions.js';

describe('Create Operations', () => {
  beforeEach(async () => {
    await cleanDatabase();
  });

  afterAll(async () => {
    await disconnectPrisma();
  });

  /**
   * ============================================
   * SINGLE CREATE
   * ============================================
   */
  describe('create()', () => {
    describe('Basic Creation', () => {
      it('should create a record with required fields only', async () => {
        const user = await DB.users.create({
          email: 'minimal@test.com',
        });

        expect(user).toBeDefined();
        expect(user.id).toBeDefined();
        expect(user.email).toBe('minimal@test.com');
        expect(user.name).toBeNull();
        expect(user.status).toBe('pending'); // default value
      });

      it('should create a record with all fields', async () => {
        const user = await DB.users.create({
          email: 'complete@test.com',
          name: 'Complete User',
          status: 'active',
        });

        expect(user.email).toBe('complete@test.com');
        expect(user.name).toBe('Complete User');
        expect(user.status).toBe('active');
      });

      it('should auto-generate id', async () => {
        const user1 = await DB.users.create({ email: 'first@test.com' });
        const user2 = await DB.users.create({ email: 'second@test.com' });

        expect(user1.id).toBeDefined();
        expect(user2.id).toBeDefined();
        expect(user2.id).toBeGreaterThan(user1.id);
      });

      it('should auto-set createdAt timestamp', async () => {
        const user = await DB.users.create({ email: 'timestamp@test.com' });

        expect(user.createdAt).toBeDefined();
        assertRecentlyCreated(user);
      });

      it('should auto-set updatedAt timestamp', async () => {
        const user = await DB.users.create({ email: 'updated@test.com' });

        expect(user.updatedAt).toBeDefined();
        assertRecentlyCreated({ createdAt: user.updatedAt });
      });
    });

    describe('Data Types', () => {
      it('should handle null values for optional fields', async () => {
        const user = await DB.users.create({
          email: 'nullable@test.com',
          name: null,
        });

        expect(user.name).toBeNull();
      });

      it('should handle empty string', async () => {
        const user = await DB.users.create({
          email: 'empty@test.com',
          name: '',
        });

        expect(user.name).toBe('');
      });

      it('should handle special characters in strings', async () => {
        const user = await DB.users.create({
          email: 'special@test.com',
          name: "O'Brien & Sons <test>",
        });

        expect(user.name).toBe("O'Brien & Sons <test>");
      });

      it('should handle unicode characters', async () => {
        const user = await DB.users.create({
          email: 'unicode@test.com',
          name: '日本語テスト 🎉',
        });

        expect(user.name).toBe('日本語テスト 🎉');
      });

      it('should handle very long strings', async () => {
        const longName = 'A'.repeat(1000);
        const user = await DB.users.create({
          email: 'long@test.com',
          name: longName,
        });

        expect(user.name).toBe(longName);
      });
    });

    describe('Error Handling', () => {
      it('should throw error for duplicate unique field', async () => {
        await DB.users.create({ email: 'duplicate@test.com' });

        await expect(
          DB.users.create({ email: 'duplicate@test.com' })
        ).rejects.toThrow();
      });

      it('should throw error for missing required field', async () => {
        await expect(
          DB.users.create({} as any)
        ).rejects.toThrow();
      });

      it('should throw error for invalid field type', async () => {
        await expect(
          DB.users.create({
            email: 'invalid@test.com',
            name: 123 as any,
          })
        ).rejects.toThrow();
      });
    });

    describe('Create with Relations', () => {
      it('should create record with relation id', async () => {
        const user = await createUser();
        const post = await DB.posts.create({
          title: 'Test Post',
          authorId: user.id,
        });

        expect(post.authorId).toBe(user.id);
      });

      it('should throw error for invalid relation id', async () => {
        await expect(
          DB.posts.create({
            title: 'Orphan Post',
            authorId: 99999,
          })
        ).rejects.toThrow();
      });
    });

    describe('Return Value', () => {
      it('should return complete created record', async () => {
        const user = await DB.users.create({
          email: 'return@test.com',
          name: 'Return User',
          status: 'active',
        });

        expect(user).toHaveProperty('id');
        expect(user).toHaveProperty('email');
        expect(user).toHaveProperty('name');
        expect(user).toHaveProperty('status');
        expect(user).toHaveProperty('createdAt');
        expect(user).toHaveProperty('updatedAt');
      });
    });
  });

  /**
   * ============================================
   * BATCH CREATE
   * ============================================
   */
  describe('createMany()', () => {
    describe('Basic Batch Creation', () => {
      it('should create multiple records', async () => {
        const result = await DB.users.createMany([
          { email: 'batch1@test.com', name: 'Batch 1' },
          { email: 'batch2@test.com', name: 'Batch 2' },
          { email: 'batch3@test.com', name: 'Batch 3' },
        ]);

        expect(result.count).toBe(3);
      });

      it('should persist all created records', async () => {
        await DB.users.createMany([
          { email: 'persist1@test.com' },
          { email: 'persist2@test.com' },
          { email: 'persist3@test.com' },
        ]);

        const count = await DB.users.count();
        expect(count).toBe(3);
      });

      it('should handle empty array', async () => {
        const result = await DB.users.createMany([]);

        expect(result.count).toBe(0);
      });

      it('should handle single item array', async () => {
        const result = await DB.users.createMany([
          { email: 'single@test.com' },
        ]);

        expect(result.count).toBe(1);
      });
    });

    describe('Large Batch Creation', () => {
      it('should handle 100 records', async () => {
        const data = Array.from({ length: 100 }, (_, i) => ({
          email: `bulk-${i}@test.com`,
          name: `Bulk User ${i}`,
        }));

        const result = await DB.users.createMany(data);

        expect(result.count).toBe(100);
      });

      it('should handle 500 records', async () => {
        const data = Array.from({ length: 500 }, (_, i) => ({
          email: `large-${i}@test.com`,
        }));

        const result = await DB.users.createMany(data);

        expect(result.count).toBe(500);
      });
    });

    describe('Error Handling', () => {
      it('should fail entire batch on duplicate', async () => {
        await DB.users.create({ email: 'existing@test.com' });

        await expect(
          DB.users.createMany([
            { email: 'new1@test.com' },
            { email: 'existing@test.com' }, // duplicate
            { email: 'new2@test.com' },
          ])
        ).rejects.toThrow();

        // Verify batch was not partially created
        const count = await DB.users.count();
        expect(count).toBe(1); // Only the original record
      });

      it('should fail on invalid data in batch', async () => {
        await expect(
          DB.users.createMany([
            { email: 'valid@test.com' },
            {} as any, // missing required field
          ])
        ).rejects.toThrow();
      });
    });

    describe('Data Integrity', () => {
      it('should create records with correct data', async () => {
        await DB.users.createMany([
          { email: 'a@test.com', name: 'Alice', status: 'active' },
          { email: 'b@test.com', name: 'Bob', status: 'pending' },
        ]);

        const alice = await DB.users.where({ email: 'a@test.com' }).findFirst();
        const bob = await DB.users.where({ email: 'b@test.com' }).findFirst();

        expect(alice?.name).toBe('Alice');
        expect(alice?.status).toBe('active');
        expect(bob?.name).toBe('Bob');
        expect(bob?.status).toBe('pending');
      });

      it('should apply default values', async () => {
        await DB.users.createMany([
          { email: 'default1@test.com' },
          { email: 'default2@test.com' },
        ]);

        const users = await DB.users.findMany();

        expect(users[0].status).toBe('pending');
        expect(users[1].status).toBe('pending');
      });
    });

    describe('With Relations', () => {
      it('should create many posts for a user', async () => {
        const user = await createUser();

        const result = await DB.posts.createMany([
          { title: 'Post 1', authorId: user.id },
          { title: 'Post 2', authorId: user.id },
          { title: 'Post 3', authorId: user.id },
        ]);

        expect(result.count).toBe(3);

        const posts = await DB.posts.where({ authorId: user.id }).findMany();
        expect(posts).toHaveLength(3);
      });
    });
  });

  /**
   * ============================================
   * CREATE INTEGRATION SCENARIOS
   * ============================================
   */
  describe('Integration Scenarios', () => {
    it('should create and immediately query', async () => {
      const email = uniqueEmail();
      await DB.users.create({ email, name: 'Query Test' });

      const found = await DB.users.where({ email }).findFirst();

      expect(found).toBeDefined();
      expect(found?.name).toBe('Query Test');
    });

    it('should create multiple related records', async () => {
      const user = await DB.users.create({
        email: 'author@test.com',
        name: 'Author',
      });

      await DB.posts.createMany([
        { title: 'Post 1', authorId: user.id, published: true },
        { title: 'Post 2', authorId: user.id, published: false },
      ]);

      const userWithPosts = await DB.users
        .withId(user.id)
        .include('posts')
        .findFirst();

      expect(userWithPosts?.posts).toHaveLength(2);
    });

    it('should handle concurrent creates', async () => {
      const promises = Array.from({ length: 10 }, (_, i) =>
        DB.users.create({ email: `concurrent-${i}@test.com` })
      );

      const results = await Promise.all(promises);

      expect(results).toHaveLength(10);
      expect(new Set(results.map((r) => r.id)).size).toBe(10); // All unique IDs
    });
  });
});
