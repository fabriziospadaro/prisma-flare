/**
 * Query Builder Integration Tests
 */

import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import { DB } from 'prisma-flare/generated';
import { cleanDatabase, disconnectPrisma } from './helpers.js';

describe('FlareBuilder Integration Tests', () => {
  beforeEach(async () => {
    await cleanDatabase();
  });

  afterAll(async () => {
    await disconnectPrisma();
  });

  describe('Basic CRUD Operations', () => {
    it('should create a user', async () => {
      const user = await DB.users.create({
        email: 'test@example.com',
        name: 'Test User',
      });

      expect(user).toBeDefined();
      expect(user.email).toBe('test@example.com');
      expect(user.name).toBe('Test User');
    });

    it('should create many users', async () => {
      const result = await DB.users.createMany([
        { email: 'user1@example.com', name: 'User One' },
        { email: 'user2@example.com', name: 'User Two' },
      ]);

      expect(result.count).toBe(2);
    });

    it('should query users with where condition', async () => {
      await DB.users.createMany([
        { email: 'user1@example.com', name: 'User One' },
        { email: 'user2@example.com', name: 'User Two' },
      ]);

      const users = await DB.users
        .where({ name: { contains: 'One' } })
        .findMany();

      expect(users).toHaveLength(1);
      expect(users[0].name).toBe('User One');
    });

    it('should handle withId', async () => {
      const created = await DB.users.create({
        email: 'test@example.com',
        name: 'Test',
      });

      const found = await DB.users.withId(created.id).findFirst();

      expect(found).toBeDefined();
      expect(found?.id).toBe(created.id);
    });

    it('should update a user', async () => {
      const user = await DB.users.create({
        email: 'test@example.com',
        name: 'Original',
      });

      const updated = await DB.users.withId(user.id).update({
        name: 'Updated'
      });

      expect(updated.name).toBe('Updated');
    });

    it('should update many users', async () => {
      await DB.users.createMany([
        { email: 'u1@example.com', name: 'Old', status: 'pending' },
        { email: 'u2@example.com', name: 'Old', status: 'pending' },
      ]);

      const result = await DB.users.where({ status: 'pending' }).updateMany({
        status: 'active'
      });

      expect(result.count).toBe(2);

      const users = await DB.users.where({ status: 'active' }).findMany();
      expect(users).toHaveLength(2);
    });

    it('should delete a user', async () => {
      const user = await DB.users.create({
        email: 'test@example.com',
        name: 'To Delete',
      });

      const deleted = await DB.users.withId(user.id).delete();
      expect(deleted.id).toBe(user.id);

      const found = await DB.users.withId(user.id).findUnique();
      expect(found).toBeNull();
    });

    it('should delete many users', async () => {
      await DB.users.createMany([
        { email: 'u1@example.com', name: 'Delete Me' },
        { email: 'u2@example.com', name: 'Delete Me' },
        { email: 'u3@example.com', name: 'Keep Me' },
      ]);

      const result = await DB.users.where({ name: 'Delete Me' }).deleteMany();
      expect(result.count).toBe(2);

      const count = await DB.users.count();
      expect(count).toBe(1);
    });

    it('should upsert a user', async () => {
      // Create case
      const created = await DB.users.where({ email: 'upsert@example.com' }).upsert({
        create: { email: 'upsert@example.com', name: 'Created' },
        update: { name: 'Updated' },
      });
      expect(created.name).toBe('Created');

      // Update case
      const updated = await DB.users.where({ email: 'upsert@example.com' }).upsert({
        create: { email: 'upsert@example.com', name: 'Created' },
        update: { name: 'Updated' },
      });
      expect(updated.name).toBe('Updated');
    });
  });

  describe('Query Modifiers', () => {
    it('should limit results', async () => {
      await DB.users.createMany([
        { email: '1@e.com' }, { email: '2@e.com' }, { email: '3@e.com' }
      ]);

      const users = await DB.users.limit(2).findMany();
      expect(users).toHaveLength(2);
    });

    it('should skip results', async () => {
      await DB.users.createMany([
        { email: '1@e.com', name: 'A' },
        { email: '2@e.com', name: 'B' },
        { email: '3@e.com', name: 'C' }
      ]);

      const users = await DB.users.order({ name: 'asc' }).skip(1).findMany();
      expect(users).toHaveLength(2);
      expect(users[0].name).toBe('B');
    });

    it('should order results', async () => {
      await DB.users.createMany([
        { email: 'b@e.com', name: 'B' },
        { email: 'a@e.com', name: 'A' },
      ]);

      const users = await DB.users.order({ name: 'asc' }).findMany();
      expect(users[0].name).toBe('A');
    });

    it('should select specific fields', async () => {
      await DB.users.create({
        email: 'test@example.com',
        name: 'Test',
      });

      const user = await DB.users.select({ email: true }).findFirst();
      expect(user).toHaveProperty('email');
      expect(user).not.toHaveProperty('name');
    });

    it('should use distinct', async () => {
      await DB.users.createMany([
        { email: '1@e.com', name: 'Same' },
        { email: '2@e.com', name: 'Same' },
        { email: '3@e.com', name: 'Different' },
      ]);
    });
  });
});
