/**
 * CRUD Operations Tests
 *
 * Tests all Create, Read, Update, Delete operations.
 */

import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import { DB } from 'prisma-flare/generated';
import { cleanDatabase, disconnect, resetCounter, uniqueEmail, hookRegistry } from '#test-helpers';

describe('CRUD Operations', () => {
  beforeEach(async () => {
    await cleanDatabase();
    hookRegistry.clearAll();
    resetCounter();
  });

  afterAll(async () => {
    await disconnect();
  });

  // ==================== CREATE ====================
  describe('create', () => {
    it('creates a record with required fields', async () => {
      const user = await DB.users.create({ email: 'test@example.com' });

      expect(user.id).toBeDefined();
      expect(user.email).toBe('test@example.com');
      expect(user.status).toBe('pending'); // default value
    });

    it('creates a record with all fields', async () => {
      const user = await DB.users.create({
        email: 'full@example.com',
        name: 'Full User',
        status: 'active',
      });

      expect(user.name).toBe('Full User');
      expect(user.status).toBe('active');
    });

    it('auto-generates timestamps', async () => {
      const user = await DB.users.create({ email: uniqueEmail() });

      expect(user.createdAt).toBeInstanceOf(Date);
      expect(user.updatedAt).toBeInstanceOf(Date);
    });

    it('enforces unique constraints', async () => {
      await DB.users.create({ email: 'unique@example.com' });

      await expect(
        DB.users.create({ email: 'unique@example.com' })
      ).rejects.toThrow();
    });

    it('creates with nested relations', async () => {
      const user = await DB.users.include('posts').create({
        email: uniqueEmail(),
        posts: {
          create: [{ title: 'Post 1' }, { title: 'Post 2' }],
        },
      });

      expect(user.posts).toHaveLength(2);
    });
  });

  describe('createMany', () => {
    it('creates multiple records', async () => {
      const result = await DB.users.createMany([
        { email: 'user1@example.com' },
        { email: 'user2@example.com' },
        { email: 'user3@example.com' },
      ]);

      expect(result.count).toBe(3);
    });

    it('applies default values', async () => {
      await DB.users.createMany([
        { email: 'default1@example.com' },
        { email: 'default2@example.com' },
      ]);

      const users = await DB.users.findMany();
      expect(users.every(u => u.status === 'pending')).toBe(true);
    });
  });

  // ==================== READ ====================
  describe('findMany', () => {
    it('returns empty array when no records', async () => {
      const users = await DB.users.findMany();
      expect(users).toEqual([]);
    });

    it('returns all records', async () => {
      await DB.users.createMany([
        { email: 'a@test.com' },
        { email: 'b@test.com' },
        { email: 'c@test.com' },
      ]);

      const users = await DB.users.findMany();
      expect(users).toHaveLength(3);
    });
  });

  describe('findFirst', () => {
    it('returns null when no records', async () => {
      const user = await DB.users.findFirst();
      expect(user).toBeNull();
    });

    it('returns first matching record', async () => {
      await DB.users.create({ email: 'first@test.com' });
      await DB.users.create({ email: 'second@test.com' });

      const user = await DB.users.order({ id: 'asc' }).findFirst();
      expect(user?.email).toBe('first@test.com');
    });
  });

  describe('findUnique', () => {
    it('finds by id', async () => {
      const created = await DB.users.create({ email: uniqueEmail() });

      const user = await DB.users.withId(created.id).findUnique();
      expect(user?.id).toBe(created.id);
    });

    it('returns null for non-existent id', async () => {
      const user = await DB.users.withId(99999).findUnique();
      expect(user).toBeNull();
    });
  });

  describe('findFirstOrThrow / findUniqueOrThrow', () => {
    it('throws when no record found', async () => {
      await expect(
        DB.users.where({ email: 'nonexistent@test.com' }).findFirstOrThrow()
      ).rejects.toThrow();
    });

    it('returns record when exists', async () => {
      const created = await DB.users.create({ email: 'exists@test.com' });

      const user = await DB.users.withId(created.id).findUniqueOrThrow();
      expect(user.id).toBe(created.id);
    });
  });

  // ==================== UPDATE ====================
  describe('update', () => {
    it('updates a record', async () => {
      const user = await DB.users.create({ email: uniqueEmail(), name: 'Original' });

      const updated = await DB.users.withId(user.id).update({ name: 'Updated' });

      expect(updated.name).toBe('Updated');
    });

    it('updates timestamps', async () => {
      const user = await DB.users.create({ email: uniqueEmail() });
      const originalUpdatedAt = user.updatedAt;

      await new Promise(r => setTimeout(r, 10));
      const updated = await DB.users.withId(user.id).update({ name: 'New Name' });

      expect(updated.updatedAt.getTime()).toBeGreaterThan(originalUpdatedAt.getTime());
    });
  });

  describe('updateMany', () => {
    it('updates multiple records', async () => {
      await DB.users.createMany([
        { email: 'a@test.com', status: 'pending' },
        { email: 'b@test.com', status: 'pending' },
        { email: 'c@test.com', status: 'active' },
      ]);

      const result = await DB.users
        .where({ status: 'pending' })
        .updateMany({ status: 'active' });

      expect(result.count).toBe(2);
    });
  });

  // ==================== DELETE ====================
  describe('delete', () => {
    it('deletes a record', async () => {
      const user = await DB.users.create({ email: uniqueEmail() });

      await DB.users.withId(user.id).delete();

      const found = await DB.users.withId(user.id).findUnique();
      expect(found).toBeNull();
    });
  });

  describe('deleteMany', () => {
    it('deletes multiple records', async () => {
      await DB.users.createMany([
        { email: 'a@test.com', status: 'inactive' },
        { email: 'b@test.com', status: 'inactive' },
        { email: 'c@test.com', status: 'active' },
      ]);

      const result = await DB.users
        .where({ status: 'inactive' })
        .deleteMany();

      expect(result.count).toBe(2);

      const remaining = await DB.users.count();
      expect(remaining).toBe(1);
    });
  });

  // ==================== UPSERT ====================
  describe('upsert', () => {
    it('creates when not exists', async () => {
      const user = await DB.users.where({ email: 'upsert@test.com' }).upsert({
        create: { email: 'upsert@test.com', name: 'Created' },
        update: { name: 'Updated' },
      });

      expect(user.name).toBe('Created');
    });

    it('updates when exists', async () => {
      await DB.users.create({ email: 'upsert@test.com', name: 'Original' });

      const user = await DB.users.where({ email: 'upsert@test.com' }).upsert({
        create: { email: 'upsert@test.com', name: 'Created' },
        update: { name: 'Updated' },
      });

      expect(user.name).toBe('Updated');
    });
  });
});
