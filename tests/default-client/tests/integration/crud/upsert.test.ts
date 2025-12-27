/**
 * Upsert Operations Integration Tests
 *
 * Comprehensive tests for upsert operations:
 * - upsert() - create if not exists, update if exists
 */

import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import { DB } from 'prisma-flare/generated';
import { cleanDatabase, disconnectPrisma } from '../../helpers/database.js';
import { createUser, uniqueEmail } from '../../helpers/factories.js';

describe('Upsert Operations', () => {
  beforeEach(async () => {
    await cleanDatabase();
  });

  afterAll(async () => {
    await disconnectPrisma();
  });

  /**
   * ============================================
   * BASIC UPSERT
   * ============================================
   */
  describe('Basic Upsert', () => {
    describe('Create Path', () => {
      it('should create record when not exists', async () => {
        const result = await DB.users.where({ email: 'new@test.com' }).upsert({
          create: { email: 'new@test.com', name: 'New User' },
          update: { name: 'Updated User' },
        });

        expect(result.email).toBe('new@test.com');
        expect(result.name).toBe('New User');
      });

      it('should use create data for new record', async () => {
        const result = await DB.users
          .where({ email: 'create@test.com' })
          .upsert({
            create: {
              email: 'create@test.com',
              name: 'Created Name',
              status: 'active',
            },
            update: {
              name: 'Updated Name',
              status: 'inactive',
            },
          });

        expect(result.name).toBe('Created Name');
        expect(result.status).toBe('active');
      });

      it('should return complete created record', async () => {
        const result = await DB.users.where({ email: 'full@test.com' }).upsert({
          create: { email: 'full@test.com', name: 'Full User' },
          update: { name: 'Updated' },
        });

        expect(result).toHaveProperty('id');
        expect(result).toHaveProperty('email');
        expect(result).toHaveProperty('name');
        expect(result).toHaveProperty('status');
        expect(result).toHaveProperty('createdAt');
        expect(result).toHaveProperty('updatedAt');
      });
    });

    describe('Update Path', () => {
      it('should update record when exists', async () => {
        await createUser({ email: 'existing@test.com', name: 'Original' });

        const result = await DB.users
          .where({ email: 'existing@test.com' })
          .upsert({
            create: { email: 'existing@test.com', name: 'New' },
            update: { name: 'Updated' },
          });

        expect(result.name).toBe('Updated');
      });

      it('should use update data for existing record', async () => {
        await createUser({
          email: 'update@test.com',
          name: 'Original',
          status: 'pending',
        });

        const result = await DB.users.where({ email: 'update@test.com' }).upsert({
          create: { email: 'update@test.com', name: 'Created', status: 'created' },
          update: { name: 'Updated', status: 'active' },
        });

        expect(result.name).toBe('Updated');
        expect(result.status).toBe('active');
      });

      it('should preserve fields not in update', async () => {
        const original = await createUser({
          email: 'preserve@test.com',
          name: 'Original Name',
          status: 'pending',
        });

        const result = await DB.users
          .where({ email: 'preserve@test.com' })
          .upsert({
            create: { email: 'preserve@test.com', name: 'New' },
            update: { status: 'active' },
          });

        expect(result.name).toBe('Original Name');
        expect(result.status).toBe('active');
      });

      it('should update updatedAt timestamp', async () => {
        const original = await createUser({ email: 'timestamp@test.com' });

        await new Promise((resolve) => setTimeout(resolve, 10));

        const result = await DB.users
          .where({ email: 'timestamp@test.com' })
          .upsert({
            create: { email: 'timestamp@test.com' },
            update: { name: 'Updated' },
          });

        expect(new Date(result.updatedAt).getTime()).toBeGreaterThan(
          new Date(original.updatedAt).getTime()
        );
      });
    });
  });

  /**
   * ============================================
   * UPSERT WITH DIFFERENT WHERE CONDITIONS
   * ============================================
   */
  describe('Upsert with Different Where Conditions', () => {
    it('should upsert with unique email', async () => {
      // Create
      const created = await DB.users.where({ email: 'unique@test.com' }).upsert({
        create: { email: 'unique@test.com', name: 'First' },
        update: { name: 'Updated' },
      });
      expect(created.name).toBe('First');

      // Update
      const updated = await DB.users.where({ email: 'unique@test.com' }).upsert({
        create: { email: 'unique@test.com', name: 'First' },
        update: { name: 'Updated' },
      });
      expect(updated.name).toBe('Updated');
    });

    it('should upsert with id', async () => {
      const user = await createUser();

      const result = await DB.users.withId(user.id).upsert({
        create: { email: 'shouldnt@use.com' },
        update: { name: 'Updated via ID' },
      });

      expect(result.id).toBe(user.id);
      expect(result.name).toBe('Updated via ID');
    });
  });

  /**
   * ============================================
   * CONCURRENT UPSERTS
   * ============================================
   */
  describe('Concurrent Upserts', () => {
    it('should handle concurrent upserts to different records', async () => {
      const promises = Array.from({ length: 5 }, (_, i) =>
        DB.users.where({ email: `concurrent-${i}@test.com` }).upsert({
          create: { email: `concurrent-${i}@test.com`, name: `User ${i}` },
          update: { name: `Updated ${i}` },
        })
      );

      const results = await Promise.all(promises);

      expect(results).toHaveLength(5);
      expect(new Set(results.map((r) => r.email)).size).toBe(5);
    });

    it('should handle repeated upsert to same record', async () => {
      const email = uniqueEmail();

      // First upsert - creates
      const first = await DB.users.where({ email }).upsert({
        create: { email, name: 'First' },
        update: { name: 'Updated' },
      });
      expect(first.name).toBe('First');

      // Second upsert - updates
      const second = await DB.users.where({ email }).upsert({
        create: { email, name: 'First' },
        update: { name: 'Second Update' },
      });
      expect(second.name).toBe('Second Update');

      // Third upsert - updates again
      const third = await DB.users.where({ email }).upsert({
        create: { email, name: 'First' },
        update: { name: 'Third Update' },
      });
      expect(third.name).toBe('Third Update');

      // Should still be only one record
      expect(await DB.users.count()).toBe(1);
    });
  });

  /**
   * ============================================
   * ERROR HANDLING
   * ============================================
   */
  describe('Error Handling', () => {
    it('should fail with invalid create data', async () => {
      await expect(
        DB.users.where({ email: 'invalid@test.com' }).upsert({
          create: {} as any, // Missing required email
          update: { name: 'Updated' },
        })
      ).rejects.toThrow();
    });

    it('should fail with invalid update data', async () => {
      await createUser({ email: 'existing@test.com' });

      await expect(
        DB.users.where({ email: 'existing@test.com' }).upsert({
          create: { email: 'existing@test.com' },
          update: { email: null } as any, // Invalid - email cannot be null
        })
      ).rejects.toThrow();
    });

    it('should fail when create would violate unique constraint', async () => {
      await createUser({ email: 'existing@test.com' });

      await expect(
        // Where finds nothing (wrong email), so tries to create
        // But create email conflicts with existing
        DB.users.where({ email: 'nonexistent@test.com' }).upsert({
          create: { email: 'existing@test.com', name: 'Conflict' },
          update: { name: 'Updated' },
        })
      ).rejects.toThrow();
    });
  });

  /**
   * ============================================
   * UPSERT WITH RELATIONS
   * ============================================
   */
  describe('Upsert with Relations', () => {
    it('should upsert post for existing user', async () => {
      const user = await createUser();

      // Create post via upsert
      const post = await DB.posts.where({ id: 99999 }).upsert({
        create: { title: 'New Post', authorId: user.id },
        update: { title: 'Updated Post' },
      });

      expect(post.title).toBe('New Post');
      expect(post.authorId).toBe(user.id);

      // Update same post
      const updated = await DB.posts.withId(post.id).upsert({
        create: { title: 'New Post', authorId: user.id },
        update: { title: 'Updated Post' },
      });

      expect(updated.title).toBe('Updated Post');
    });

    it('should fail upsert with invalid relation', async () => {
      await expect(
        DB.posts.where({ id: 99999 }).upsert({
          create: { title: 'Orphan Post', authorId: 99999 },
          update: { title: 'Updated' },
        })
      ).rejects.toThrow();
    });
  });

  /**
   * ============================================
   * INTEGRATION SCENARIOS
   * ============================================
   */
  describe('Integration Scenarios', () => {
    it('should implement "find or create" pattern', async () => {
      const email = 'findorcreate@test.com';

      const findOrCreate = async () =>
        DB.users.where({ email }).upsert({
          create: { email, name: 'Default Name', status: 'new' },
          update: {}, // No-op update
        });

      // First call creates
      const first = await findOrCreate();
      expect(first.name).toBe('Default Name');
      const firstId = first.id;

      // Second call finds
      const second = await findOrCreate();
      expect(second.id).toBe(firstId);

      // Still only one record
      expect(await DB.users.count()).toBe(1);
    });

    it('should implement "increment on conflict" pattern', async () => {
      const user = await createUser();

      // Create post with initial views using regular create
      const post = await DB.posts.create({
        title: 'Popular Post',
        authorId: user.id,
        views: 1,
      });
      expect(post.views).toBe(1);

      // Upsert increments views using the ID
      const updated = await DB.posts.withId(post.id).upsert({
        create: { title: 'Popular Post', authorId: user.id, views: 1 },
        update: { views: { increment: 1 } },
      });
      expect(updated.views).toBe(2);
    });

    it('should sync external data', async () => {
      // Simulating external data sync
      const externalUsers = [
        { email: 'external1@test.com', name: 'External User 1' },
        { email: 'external2@test.com', name: 'External User 2' },
      ];

      // First sync - creates
      for (const userData of externalUsers) {
        await DB.users.where({ email: userData.email }).upsert({
          create: userData,
          update: { name: userData.name },
        });
      }

      expect(await DB.users.count()).toBe(2);

      // Second sync with updated names - updates
      const updatedExternalUsers = [
        { email: 'external1@test.com', name: 'Updated External User 1' },
        { email: 'external2@test.com', name: 'Updated External User 2' },
      ];

      for (const userData of updatedExternalUsers) {
        await DB.users.where({ email: userData.email }).upsert({
          create: userData,
          update: { name: userData.name },
        });
      }

      expect(await DB.users.count()).toBe(2);

      const users = await DB.users.order({ email: 'asc' }).findMany();
      expect(users[0].name).toBe('Updated External User 1');
      expect(users[1].name).toBe('Updated External User 2');
    });
  });
});
