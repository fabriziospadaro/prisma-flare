/**
 * Hooks Integration Tests - prisma-client Provider
 *
 * Verifies hooks system works correctly with new prisma-client provider
 */

import { describe, it, expect, beforeEach, afterAll, vi } from 'vitest';
import {
  beforeCreate,
  afterCreate,
  beforeUpdate,
  afterUpdate,
  beforeDelete,
  afterDelete,
  hookRegistry,
} from 'prisma-flare';
import { cleanDatabase, disconnectDatabase, getClient } from '../helpers';
import { createUser, resetCounters } from '../helpers';

const db = getClient();

describe('Hooks - prisma-client Provider', () => {
  beforeEach(async () => {
    await cleanDatabase();
    hookRegistry.clearAll();
    resetCounters();
  });

  afterAll(async () => {
    hookRegistry.clearAll();
    await disconnectDatabase();
  });

  describe('beforeCreate', () => {
    it('should execute before creating a record', async () => {
      const callback = vi.fn();
      beforeCreate('user', callback);

      await db.user.create({ data: { email: 'hook@test.com', name: 'Hook User' } });

      expect(callback).toHaveBeenCalledTimes(1);
    });

    it('should receive args and prisma client', async () => {
      const callback = vi.fn();
      beforeCreate('user', callback);

      await db.user.create({ data: { email: 'args@test.com', name: 'Args User' } });

      expect(callback).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ email: 'args@test.com' }),
        }),
        expect.anything()
      );
    });

    it('should block creation when hook throws', async () => {
      beforeCreate('user', () => {
        throw new Error('Validation failed');
      });

      await expect(
        db.user.create({ data: { email: 'blocked@test.com' } })
      ).rejects.toThrow('Validation failed');

      // Verify not created
      const count = await db.user.count();
      expect(count).toBe(0);
    });

    it('should allow modifying args', async () => {
      beforeCreate('user', (args) => {
        args.data.name = 'Modified Name';
      });

      const user = await db.user.create({
        data: { email: 'modify@test.com', name: 'Original' },
      });

      expect(user.name).toBe('Modified Name');
    });
  });

  describe('afterCreate', () => {
    it('should execute after creating a record', async () => {
      const callback = vi.fn();
      afterCreate('user', callback);

      await db.user.create({ data: { email: 'after@test.com' } });

      expect(callback).toHaveBeenCalledTimes(1);
    });

    it('should receive args, result, and prisma client', async () => {
      const callback = vi.fn();
      afterCreate('user', callback);

      const user = await db.user.create({ data: { email: 'result@test.com' } });

      expect(callback).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ email: 'result@test.com' }),
        }),
        expect.objectContaining({ id: user.id }),
        expect.anything()
      );
    });
  });

  describe('beforeUpdate', () => {
    it('should execute before updating a record', async () => {
      const callback = vi.fn();
      beforeUpdate('user', callback);

      const user = await createUser();
      await db.user.update({ where: { id: user.id }, data: { name: 'Updated' } });

      expect(callback).toHaveBeenCalledTimes(1);
    });

    it('should block update when hook throws', async () => {
      beforeUpdate('user', () => {
        throw new Error('Update blocked');
      });

      const user = await createUser({ name: 'Original' });

      await expect(
        db.user.update({ where: { id: user.id }, data: { name: 'Updated' } })
      ).rejects.toThrow('Update blocked');

      // Verify not updated
      const found = await db.user.findUnique({ where: { id: user.id } });
      expect(found?.name).toBe('Original');
    });
  });

  describe('afterUpdate', () => {
    it('should execute after updating a record', async () => {
      const callback = vi.fn();
      afterUpdate('user', callback);

      const user = await createUser();
      await db.user.update({ where: { id: user.id }, data: { name: 'Updated' } });

      expect(callback).toHaveBeenCalledTimes(1);
    });
  });

  describe('beforeDelete', () => {
    it('should execute before deleting a record', async () => {
      const callback = vi.fn();
      beforeDelete('user', callback);

      const user = await createUser();
      await db.user.delete({ where: { id: user.id } });

      expect(callback).toHaveBeenCalledTimes(1);
    });

    it('should block deletion when hook throws', async () => {
      beforeDelete('user', () => {
        throw new Error('Delete blocked');
      });

      const user = await createUser();

      await expect(db.user.delete({ where: { id: user.id } })).rejects.toThrow(
        'Delete blocked'
      );

      // Verify not deleted
      const found = await db.user.findUnique({ where: { id: user.id } });
      expect(found).not.toBeNull();
    });
  });

  describe('afterDelete', () => {
    it('should execute after deleting a record', async () => {
      const callback = vi.fn();
      afterDelete('user', callback);

      const user = await createUser();
      await db.user.delete({ where: { id: user.id } });

      expect(callback).toHaveBeenCalledTimes(1);
    });
  });

  describe('Hook Registry', () => {
    it('should clear all hooks', async () => {
      const callback = vi.fn();
      beforeCreate('user', callback);
      afterCreate('user', callback);

      hookRegistry.clearAll();

      await createUser();

      expect(callback).not.toHaveBeenCalled();
    });
  });
});
