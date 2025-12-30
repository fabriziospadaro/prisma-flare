/**
 * Hooks System Integration Tests
 *
 * Comprehensive tests for the hooks/callbacks system:
 * - beforeCreate, afterCreate
 * - beforeUpdate, afterUpdate
 * - beforeDelete, afterDelete
 * - afterChange (column change detection)
 * - afterUpsert
 * - Hook configuration
 * - Hook registry
 */

import { describe, it, expect, beforeEach, afterAll, afterEach, vi } from 'vitest';
import {
  beforeCreate,
  afterCreate,
  beforeUpdate,
  afterUpdate,
  beforeDelete,
  afterDelete,
  afterChange,
  hookRegistry,
} from 'prisma-flare';
import { DB } from 'prisma-flare/generated';
import { cleanDatabase, disconnectPrisma } from '../helpers/database.js';
import { createUser, createUsers, createUserWithPosts } from '../helpers/factories.js';

describe('Hooks System', () => {
  beforeEach(async () => {
    await cleanDatabase();
    hookRegistry.clearAll();
    // Reset configuration to defaults
    hookRegistry.configure({
      enableColumnHooks: true,
      maxRefetch: 1000,
      warnOnSkip: false,
    });
  });

  afterAll(async () => {
    hookRegistry.clearAll();
    await disconnectPrisma();
  });

  /**
   * ============================================
   * BEFORE CREATE HOOKS
   * ============================================
   */
  describe('beforeCreate', () => {
    it('should execute before creating a record', async () => {
      const callback = vi.fn();
      beforeCreate('user', callback);

      await DB.users.create({ email: 'test@test.com' });

      expect(callback).toHaveBeenCalledTimes(1);
    });

    it('should receive args and prisma client', async () => {
      const callback = vi.fn();
      beforeCreate('user', callback);

      await DB.users.create({ email: 'args@test.com', name: 'Test' });

      expect(callback).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            email: 'args@test.com',
            name: 'Test',
          }),
        }),
        expect.anything() // Prisma client
      );
    });

    it('should block creation when hook throws', async () => {
      beforeCreate('user', () => {
        throw new Error('Validation failed');
      });

      await expect(
        DB.users.create({ email: 'blocked@test.com' })
      ).rejects.toThrow('Validation failed');

      // Record should not exist
      const count = await DB.users.count();
      expect(count).toBe(0);
    });

    it('should allow modifying args', async () => {
      beforeCreate('user', (args) => {
        // Modify the data
        args.data.name = 'Modified Name';
      });

      const user = await DB.users.create({ email: 'modify@test.com', name: 'Original' });

      expect(user.name).toBe('Modified Name');
    });

    it('should support multiple hooks', async () => {
      const hook1 = vi.fn();
      const hook2 = vi.fn();

      beforeCreate('user', hook1);
      beforeCreate('user', hook2);

      await DB.users.create({ email: 'multi@test.com' });

      expect(hook1).toHaveBeenCalled();
      expect(hook2).toHaveBeenCalled();
    });

    it('should only trigger for specified model', async () => {
      const userHook = vi.fn();
      const postHook = vi.fn();

      beforeCreate('user', userHook);
      beforeCreate('post', postHook);

      await DB.users.create({ email: 'model@test.com' });

      expect(userHook).toHaveBeenCalled();
      expect(postHook).not.toHaveBeenCalled();
    });

    it('should implement validation pattern', async () => {
      beforeCreate('user', (args) => {
        if (!args.data.email.includes('@')) {
          throw new Error('Invalid email format');
        }
      });

      await expect(
        DB.users.create({ email: 'invalid-email' })
      ).rejects.toThrow('Invalid email format');

      await expect(
        DB.users.create({ email: 'valid@test.com' })
      ).resolves.toBeDefined();
    });
  });

  /**
   * ============================================
   * AFTER CREATE HOOKS
   * ============================================
   */
  describe('afterCreate', () => {
    it('should execute after creating a record', async () => {
      const callback = vi.fn();
      afterCreate('user', callback);

      const user = await DB.users.create({ email: 'after@test.com' });

      expect(callback).toHaveBeenCalledTimes(1);
    });

    it('should receive args, result, and prisma client', async () => {
      const callback = vi.fn();
      afterCreate('user', callback);

      const user = await DB.users.create({ email: 'result@test.com' });

      expect(callback).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ email: 'result@test.com' }),
        }),
        expect.objectContaining({
          id: user.id,
          email: 'result@test.com',
        }),
        expect.anything()
      );
    });

    it('should log error from after hook but complete operation', async () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      afterCreate('user', () => {
        throw new Error('After hook error');
      });

      // After hooks run after the operation - errors are logged but operation completes
      const user = await DB.users.create({ email: 'aftererror@test.com' });

      // Operation should succeed even if after hook fails
      expect(user.email).toBe('aftererror@test.com');

      // Error should be logged
      expect(consoleSpy).toHaveBeenCalled();

      consoleSpy.mockRestore();
    });

    it('should be useful for side effects', async () => {
      const sideEffectData: any[] = [];

      afterCreate('user', (args, result) => {
        sideEffectData.push({
          action: 'user_created',
          userId: result.id,
          email: result.email,
        });
      });

      const user = await DB.users.create({ email: 'sideeffect@test.com' });

      expect(sideEffectData).toHaveLength(1);
      expect(sideEffectData[0]).toEqual({
        action: 'user_created',
        userId: user.id,
        email: 'sideeffect@test.com',
      });
    });
  });

  /**
   * ============================================
   * BEFORE UPDATE HOOKS
   * ============================================
   */
  describe('beforeUpdate', () => {
    it('should execute before updating a record', async () => {
      const callback = vi.fn();
      beforeUpdate('user', callback);

      const user = await createUser();
      await DB.users.withId(user.id).update({ name: 'Updated' });

      expect(callback).toHaveBeenCalledTimes(1);
    });

    it('should block update when hook throws', async () => {
      beforeUpdate('user', () => {
        throw new Error('Update blocked');
      });

      const user = await createUser({ name: 'Original' });

      await expect(
        DB.users.withId(user.id).update({ name: 'Updated' })
      ).rejects.toThrow('Update blocked');

      // Verify not updated
      const found = await DB.users.withId(user.id).findUnique();
      expect(found?.name).toBe('Original');
    });

    it('should allow modifying update data', async () => {
      beforeUpdate('user', (args) => {
        if (args.data.name) {
          args.data.name = args.data.name.toUpperCase();
        }
      });

      const user = await createUser();
      const updated = await DB.users.withId(user.id).update({ name: 'lowercase' });

      expect(updated.name).toBe('LOWERCASE');
    });
  });

  /**
   * ============================================
   * AFTER UPDATE HOOKS
   * ============================================
   */
  describe('afterUpdate', () => {
    it('should execute after updating a record', async () => {
      const callback = vi.fn();
      afterUpdate('user', callback);

      const user = await createUser();
      await DB.users.withId(user.id).update({ name: 'Updated' });

      expect(callback).toHaveBeenCalledTimes(1);
    });

    it('should receive updated result', async () => {
      const callback = vi.fn();
      afterUpdate('user', callback);

      const user = await createUser({ name: 'Original' });
      await DB.users.withId(user.id).update({ name: 'Updated' });

      expect(callback).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ name: 'Updated' }),
        expect.anything()
      );
    });
  });

  /**
   * ============================================
   * BEFORE DELETE HOOKS
   * ============================================
   */
  describe('beforeDelete', () => {
    it('should execute before deleting a record', async () => {
      const callback = vi.fn();
      beforeDelete('user', callback);

      const user = await createUser();
      await DB.users.withId(user.id).delete();

      expect(callback).toHaveBeenCalledTimes(1);
    });

    it('should block deletion when hook throws', async () => {
      beforeDelete('user', () => {
        throw new Error('Delete blocked');
      });

      const user = await createUser();

      await expect(
        DB.users.withId(user.id).delete()
      ).rejects.toThrow('Delete blocked');

      // Verify not deleted
      const found = await DB.users.withId(user.id).findUnique();
      expect(found).not.toBeNull();
    });
  });

  /**
   * ============================================
   * AFTER DELETE HOOKS
   * ============================================
   */
  describe('afterDelete', () => {
    it('should execute after deleting a record', async () => {
      const callback = vi.fn();
      afterDelete('user', callback);

      const user = await createUser();
      await DB.users.withId(user.id).delete();

      expect(callback).toHaveBeenCalledTimes(1);
    });

    it('should receive deleted record data', async () => {
      const callback = vi.fn();
      afterDelete('user', callback);

      const user = await createUser({ email: 'deleted@test.com' });
      await DB.users.withId(user.id).delete();

      expect(callback).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ email: 'deleted@test.com' }),
        expect.anything()
      );
    });
  });

  /**
   * ============================================
   * AFTER CHANGE (COLUMN HOOKS)
   * ============================================
   */
  describe('afterChange', () => {
    it('should detect when specific field changes', async () => {
      const callback = vi.fn();
      afterChange('user', 'status', callback);

      const user = await createUser({ status: 'pending' });
      await DB.users.withId(user.id).update({ status: 'active' });

      expect(callback).toHaveBeenCalledWith(
        'pending',
        'active',
        expect.objectContaining({ id: user.id }),
        expect.anything()
      );
    });

    it('should not trigger when field does not change', async () => {
      const callback = vi.fn();
      afterChange('user', 'status', callback);

      const user = await createUser({ status: 'pending' });
      await DB.users.withId(user.id).update({ name: 'New Name' });

      expect(callback).not.toHaveBeenCalled();
    });

    it('should not trigger when value remains same', async () => {
      const callback = vi.fn();
      afterChange('user', 'status', callback);

      const user = await createUser({ status: 'pending' });
      await DB.users.withId(user.id).update({ status: 'pending' });

      expect(callback).not.toHaveBeenCalled();
    });

    it('should trigger for updateMany', async () => {
      const callback = vi.fn();
      afterChange('user', 'status', callback);

      await DB.users.createMany([
        { email: 'u1@test.com', status: 'pending' },
        { email: 'u2@test.com', status: 'pending' },
      ]);

      await DB.users.where({ status: 'pending' }).updateMany({ status: 'active' });

      expect(callback).toHaveBeenCalledTimes(2);
    });

    it('should work with select that excludes changed field', async () => {
      const callback = vi.fn();
      afterChange('user', 'status', callback);

      const user = await createUser({ status: 'pending' });

      // Update with select that doesn't include status
      await DB.users
        .withId(user.id)
        .select({ id: true, email: true })
        .update({ status: 'active' });

      expect(callback).toHaveBeenCalled();
    });

    it('should handle null to value change', async () => {
      const callback = vi.fn();
      afterChange('user', 'name', callback);

      // Create user directly with null name (bypassing factory default)
      const user = await DB.users.create({ email: 'nullname@test.com', name: null });
      await DB.users.withId(user.id).update({ name: 'New Name' });

      expect(callback).toHaveBeenCalledWith(
        null,
        'New Name',
        expect.anything(),
        expect.anything()
      );
    });

    it('should handle value to null change', async () => {
      const callback = vi.fn();
      afterChange('user', 'name', callback);

      const user = await createUser({ name: 'Has Name' });
      await DB.users.withId(user.id).update({ name: null });

      expect(callback).toHaveBeenCalledWith(
        'Has Name',
        null,
        expect.anything(),
        expect.anything()
      );
    });
  });

  /**
   * ============================================
   * HOOK CONFIGURATION
   * ============================================
   */
  describe('Hook Configuration', () => {
    it('should allow disabling column hooks globally', async () => {
      const callback = vi.fn();
      afterChange('user', 'status', callback);

      hookRegistry.configure({ enableColumnHooks: false });

      const user = await createUser({ status: 'pending' });
      await DB.users.withId(user.id).update({ status: 'active' });

      expect(callback).not.toHaveBeenCalled();
    });

    it('should respect maxRefetch limit', async () => {
      const callback = vi.fn();
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      afterChange('user', 'status', callback);
      hookRegistry.configure({ maxRefetch: 2, warnOnSkip: true });

      await DB.users.createMany([
        { email: 'u1@test.com', status: 'pending' },
        { email: 'u2@test.com', status: 'pending' },
        { email: 'u3@test.com', status: 'pending' },
      ]);

      await DB.users.where({ status: 'pending' }).updateMany({ status: 'active' });

      expect(callback).not.toHaveBeenCalled();
      expect(warnSpy).toHaveBeenCalledWith(
        expect.stringContaining('Skipping column hooks')
      );

      warnSpy.mockRestore();
    });

    it('should run column hooks when under maxRefetch', async () => {
      const callback = vi.fn();
      afterChange('user', 'status', callback);
      hookRegistry.configure({ maxRefetch: 10 });

      await DB.users.createMany([
        { email: 'u1@test.com', status: 'pending' },
        { email: 'u2@test.com', status: 'pending' },
      ]);

      await DB.users.where({ status: 'pending' }).updateMany({ status: 'active' });

      expect(callback).toHaveBeenCalledTimes(2);
    });

    it('should expose current configuration', () => {
      hookRegistry.configure({ maxRefetch: 5000, enableColumnHooks: true });

      const config = hookRegistry.getConfig();

      expect(config.maxRefetch).toBe(5000);
      expect(config.enableColumnHooks).toBe(true);
    });

    it('should skip column hooks with __flare option', async () => {
      const callback = vi.fn();
      afterChange('user', 'status', callback);

      const user = await createUser({ status: 'pending' });

      await DB.users.withId(user.id).update({
        status: 'active',
        __flare: { skipColumnHooks: true },
      } as any);

      expect(callback).not.toHaveBeenCalled();
    });

    it('should still run regular hooks when column hooks skipped', async () => {
      const columnCallback = vi.fn();
      const updateCallback = vi.fn();

      afterChange('user', 'status', columnCallback);
      afterUpdate('user', updateCallback);

      const user = await createUser({ status: 'pending' });

      await DB.users.withId(user.id).update({
        status: 'active',
        __flare: { skipColumnHooks: true },
      } as any);

      expect(columnCallback).not.toHaveBeenCalled();
      expect(updateCallback).toHaveBeenCalled();
    });
  });

  /**
   * ============================================
   * HOOK REGISTRY
   * ============================================
   */
  describe('Hook Registry', () => {
    it('should clear all hooks', async () => {
      const callback = vi.fn();
      beforeCreate('user', callback);
      afterCreate('user', callback);

      hookRegistry.clearAll();

      await createUser();

      expect(callback).not.toHaveBeenCalled();
    });

    it('should support multiple models', async () => {
      const userCallback = vi.fn();
      const postCallback = vi.fn();

      afterCreate('user', userCallback);
      afterCreate('post', postCallback);

      const user = await createUser();
      await DB.posts.create({ title: 'Test', authorId: user.id });

      expect(userCallback).toHaveBeenCalledTimes(1);
      expect(postCallback).toHaveBeenCalledTimes(1);
    });
  });

  /**
   * ============================================
   * INTEGRATION SCENARIOS
   * ============================================
   */
  describe('Integration Scenarios', () => {
    it('should implement audit trail pattern', async () => {
      const auditLog: any[] = [];

      afterCreate('user', (args, result) => {
        auditLog.push({
          action: 'CREATE',
          model: 'user',
          recordId: result.id,
          timestamp: new Date(),
        });
      });

      afterUpdate('user', (args, result) => {
        auditLog.push({
          action: 'UPDATE',
          model: 'user',
          recordId: result.id,
          timestamp: new Date(),
        });
      });

      afterDelete('user', (args, result) => {
        auditLog.push({
          action: 'DELETE',
          model: 'user',
          recordId: result.id,
          timestamp: new Date(),
        });
      });

      const user = await createUser();
      await DB.users.withId(user.id).update({ name: 'Updated' });
      await DB.users.withId(user.id).delete();

      expect(auditLog).toHaveLength(3);
      expect(auditLog.map((e) => e.action)).toEqual(['CREATE', 'UPDATE', 'DELETE']);
    });

    it('should implement status transition validation', async () => {
      const validTransitions: Record<string, string[]> = {
        pending: ['active', 'rejected'],
        active: ['suspended', 'banned'],
        suspended: ['active', 'banned'],
        rejected: [],
        banned: [],
      };

      beforeUpdate('user', async (args, prisma) => {
        if (args.data.status && args.where) {
          // Get current status
          const current = await prisma.user.findFirst({
            where: args.where,
            select: { status: true },
          });

          if (current) {
            const allowed = validTransitions[current.status] || [];
            if (!allowed.includes(args.data.status)) {
              throw new Error(
                `Invalid status transition: ${current.status} -> ${args.data.status}`
              );
            }
          }
        }
      });

      const user = await createUser({ status: 'pending' });

      // Valid transition
      await expect(
        DB.users.withId(user.id).update({ status: 'active' })
      ).resolves.toBeDefined();

      // Invalid transition
      await expect(
        DB.users.withId(user.id).update({ status: 'pending' })
      ).rejects.toThrow('Invalid status transition');
    });

    it('should implement computed fields pattern', async () => {
      beforeCreate('user', (args) => {
        // Add computed/derived data
        if (args.data.email) {
          args.data.name = args.data.name || args.data.email.split('@')[0];
        }
      });

      const user = await DB.users.create({ email: 'john.doe@test.com' });

      expect(user.name).toBe('john.doe');
    });
  });
});
