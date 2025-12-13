/**
 * Query Builder Integration Tests
 */

import { describe, it, expect, beforeEach, afterAll } from 'vitest';
// @ts-ignore
import { DB } from 'prisma-flare/generated';
import { cleanDatabase, disconnectPrisma } from './helpers';

describe('QueryBuilder Integration Tests', () => {
  beforeEach(async () => {
    await cleanDatabase();
  });

  afterAll(async () => {
    await disconnectPrisma();
  });

  describe('Basic CRUD Operations', () => {
    it('should create a user', async () => {
      // @ts-ignore
      const user = await DB.users.create({
        data: {
          email: 'test@example.com',
          name: 'Test User',
        },
      });

      expect(user).toBeDefined();
      expect(user.email).toBe('test@example.com');
      expect(user.name).toBe('Test User');
    });

    it('should create many users', async () => {
      // @ts-ignore
      const result = await DB.users.createMany({
        data: [
          { email: 'user1@example.com', name: 'User One' },
          { email: 'user2@example.com', name: 'User Two' },
        ],
      });

      expect(result.count).toBe(2);
    });

    it('should query users with where condition', async () => {
      // @ts-ignore
      await DB.users.createMany({
        data: [
          { email: 'user1@example.com', name: 'User One' },
          { email: 'user2@example.com', name: 'User Two' },
        ],
      });

      // @ts-ignore
      const users = await DB.users
        .where({ name: { contains: 'One' } })
        .findMany();

      expect(users).toHaveLength(1);
      expect(users[0].name).toBe('User One');
    });

    it('should handle whereId', async () => {
      // @ts-ignore
      const created = await DB.users.create({
        data: { email: 'test@example.com', name: 'Test' },
      });

      // @ts-ignore
      const found = await DB.users.whereId(created.id).findFirst();

      expect(found).toBeDefined();
      expect(found?.id).toBe(created.id);
    });

    it('should update a user', async () => {
      // @ts-ignore
      const user = await DB.users.create({
        data: { email: 'test@example.com', name: 'Original' },
      });

      // @ts-ignore
      const updated = await DB.users.whereId(user.id).update({
        data: { name: 'Updated' },
      });

      expect(updated.name).toBe('Updated');
    });

    it('should update many users', async () => {
      // @ts-ignore
      await DB.users.createMany({
        data: [
          { email: 'u1@example.com', name: 'Old', status: 'pending' },
          { email: 'u2@example.com', name: 'Old', status: 'pending' },
        ],
      });

      // @ts-ignore
      const result = await DB.users.where({ status: 'pending' }).updateMany({
        data: { status: 'active' },
      });

      expect(result.count).toBe(2);
      
      // @ts-ignore
      const users = await DB.users.where({ status: 'active' }).findMany();
      expect(users).toHaveLength(2);
    });

    it('should delete a user', async () => {
      // @ts-ignore
      const user = await DB.users.create({
        data: { email: 'test@example.com', name: 'To Delete' },
      });

      // @ts-ignore
      const deleted = await DB.users.whereId(user.id).delete();
      expect(deleted.id).toBe(user.id);

      // @ts-ignore
      const found = await DB.users.whereId(user.id).findUnique();
      expect(found).toBeNull();
    });

    it('should delete many users', async () => {
      // @ts-ignore
      await DB.users.createMany({
        data: [
          { email: 'u1@example.com', name: 'Delete Me' },
          { email: 'u2@example.com', name: 'Delete Me' },
          { email: 'u3@example.com', name: 'Keep Me' },
        ],
      });

      // @ts-ignore
      const result = await DB.users.where({ name: 'Delete Me' }).deleteMany();
      expect(result.count).toBe(2);

      // @ts-ignore
      const count = await DB.users.count();
      expect(count).toBe(1);
    });

    it('should upsert a user', async () => {
      // Create case
      // @ts-ignore
      const created = await DB.users.where({ email: 'upsert@example.com' }).upsert({
        create: { email: 'upsert@example.com', name: 'Created' },
        update: { name: 'Updated' },
      });
      expect(created.name).toBe('Created');

      // Update case
      // @ts-ignore
      const updated = await DB.users.where({ email: 'upsert@example.com' }).upsert({
        create: { email: 'upsert@example.com', name: 'Created' },
        update: { name: 'Updated' },
      });
      expect(updated.name).toBe('Updated');
    });
  });

  describe('Query Modifiers', () => {
    it('should limit results', async () => {
      // @ts-ignore
      await DB.users.createMany({
        data: [
          { email: '1@e.com' }, { email: '2@e.com' }, { email: '3@e.com' }
        ],
      });

      // @ts-ignore
      const users = await DB.users.limit(2).findMany();
      expect(users).toHaveLength(2);
    });

    it('should skip results', async () => {
      // @ts-ignore
      await DB.users.createMany({
        data: [
          { email: '1@e.com', name: 'A' }, 
          { email: '2@e.com', name: 'B' }, 
          { email: '3@e.com', name: 'C' }
        ],
      });

      // @ts-ignore
      const users = await DB.users.order({ name: 'asc' }).skip(1).findMany();
      expect(users).toHaveLength(2);
      expect(users[0].name).toBe('B');
    });

    it('should order results', async () => {
      // @ts-ignore
      await DB.users.createMany({
        data: [
          { email: 'b@e.com', name: 'B' },
          { email: 'a@e.com', name: 'A' },
        ],
      });

      // @ts-ignore
      const users = await DB.users.order({ name: 'asc' }).findMany();
      expect(users[0].name).toBe('A');
    });

    it('should select specific fields', async () => {
      // @ts-ignore
      await DB.users.create({
        data: { email: 'test@example.com', name: 'Test' },
      });

      // @ts-ignore
      const user = await DB.users.select({ email: true }).findFirst();
      expect(user).toHaveProperty('email');
      expect(user).not.toHaveProperty('name');
    });

    it('should use distinct', async () => {
      // @ts-ignore
      await DB.users.createMany({
        data: [
          { email: '1@e.com', name: 'Same' },
          { email: '2@e.com', name: 'Same' },
          { email: '3@e.com', name: 'Different' },
        ],
      });
    });
  });
});
