/**
 * Hooks/Callbacks Tests
 *
 * Tests beforeCreate, afterCreate, beforeUpdate, afterUpdate,
 * beforeDelete, afterDelete, afterChange, afterUpsert.
 */

import { describe, it, expect, beforeEach, afterAll, vi } from 'vitest';
import {
  beforeCreate,
  afterCreate,
  beforeUpdate,
  afterUpdate,
  beforeDelete,
  afterDelete,
  afterChange,
  afterUpsert,
  hookRegistry,
} from 'prisma-flare';
import { DB } from 'prisma-flare/generated';
import { cleanDatabase, disconnect, resetCounter, uniqueEmail } from '#test-helpers';

describe('Hooks System', () => {
  beforeEach(async () => {
    await cleanDatabase();
    hookRegistry.clearAll();
    hookRegistry.configure({ enableColumnHooks: true, warnOnSkip: false });
    resetCounter();
  });

  afterAll(async () => {
    hookRegistry.clearAll();
    await disconnect();
  });

  // ==================== BEFORE CREATE ====================
  describe('beforeCreate', () => {
    it('executes before creating', async () => {
      const callback = vi.fn();
      beforeCreate('user', callback);

      await DB.users.create({ email: uniqueEmail() });

      expect(callback).toHaveBeenCalledTimes(1);
    });

    it('receives args and prisma client', async () => {
      const callback = vi.fn();
      beforeCreate('user', callback);

      await DB.users.create({ email: 'test@test.com', name: 'Test' });

      expect(callback).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ email: 'test@test.com' }),
        }),
        expect.anything()
      );
    });

    it('can modify args', async () => {
      beforeCreate('user', (args) => {
        args.data.name = 'Modified';
      });

      const user = await DB.users.create({ email: uniqueEmail(), name: 'Original' });

      expect(user.name).toBe('Modified');
    });

    it('can block creation by throwing', async () => {
      beforeCreate('user', () => {
        throw new Error('Validation failed');
      });

      await expect(
        DB.users.create({ email: uniqueEmail() })
      ).rejects.toThrow('Validation failed');

      const count = await DB.users.count();
      expect(count).toBe(0);
    });
  });

  // ==================== AFTER CREATE ====================
  describe('afterCreate', () => {
    it('executes after creating', async () => {
      const callback = vi.fn();
      afterCreate('user', callback);

      await DB.users.create({ email: uniqueEmail() });

      expect(callback).toHaveBeenCalledTimes(1);
    });

    it('receives args, result, and prisma', async () => {
      const callback = vi.fn();
      afterCreate('user', callback);

      const user = await DB.users.create({ email: 'result@test.com' });

      expect(callback).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ id: user.id, email: 'result@test.com' }),
        expect.anything()
      );
    });

    it('result has typed fields', async () => {
      let resultId: number | undefined;
      let resultEmail: string | undefined;

      afterCreate('user', (_args, result) => {
        resultId = result.id;
        resultEmail = result.email;
      });

      await DB.users.create({ email: 'typed@test.com' });

      expect(typeof resultId).toBe('number');
      expect(resultEmail).toBe('typed@test.com');
    });
  });

  // ==================== BEFORE UPDATE ====================
  describe('beforeUpdate', () => {
    it('executes before updating', async () => {
      const callback = vi.fn();
      beforeUpdate('user', callback);

      const user = await DB.users.create({ email: uniqueEmail() });
      await DB.users.withId(user.id).update({ name: 'Updated' });

      expect(callback).toHaveBeenCalledTimes(1);
    });

    it('can block update by throwing', async () => {
      beforeUpdate('user', () => {
        throw new Error('Update blocked');
      });

      const user = await DB.users.create({ email: uniqueEmail(), name: 'Original' });

      await expect(
        DB.users.withId(user.id).update({ name: 'Updated' })
      ).rejects.toThrow('Update blocked');

      const found = await DB.users.withId(user.id).findUnique();
      expect(found?.name).toBe('Original');
    });
  });

  // ==================== AFTER UPDATE ====================
  describe('afterUpdate', () => {
    it('executes after updating', async () => {
      const callback = vi.fn();
      afterUpdate('user', callback);

      const user = await DB.users.create({ email: uniqueEmail() });
      await DB.users.withId(user.id).update({ name: 'Updated' });

      expect(callback).toHaveBeenCalledTimes(1);
    });

    it('receives updated result', async () => {
      let updatedName: string | undefined;

      afterUpdate('user', (_args, result) => {
        updatedName = result.name ?? undefined;
      });

      const user = await DB.users.create({ email: uniqueEmail() });
      await DB.users.withId(user.id).update({ name: 'New Name' });

      expect(updatedName).toBe('New Name');
    });
  });

  // ==================== BEFORE DELETE ====================
  describe('beforeDelete', () => {
    it('executes before deleting', async () => {
      const callback = vi.fn();
      beforeDelete('user', callback);

      const user = await DB.users.create({ email: uniqueEmail() });
      await DB.users.withId(user.id).delete();

      expect(callback).toHaveBeenCalledTimes(1);
    });

    it('can block deletion by throwing', async () => {
      beforeDelete('user', () => {
        throw new Error('Delete blocked');
      });

      const user = await DB.users.create({ email: uniqueEmail() });

      await expect(
        DB.users.withId(user.id).delete()
      ).rejects.toThrow('Delete blocked');

      const found = await DB.users.withId(user.id).findUnique();
      expect(found).not.toBeNull();
    });
  });

  // ==================== AFTER DELETE ====================
  describe('afterDelete', () => {
    it('executes after deleting', async () => {
      const callback = vi.fn();
      afterDelete('user', callback);

      const user = await DB.users.create({ email: uniqueEmail() });
      await DB.users.withId(user.id).delete();

      expect(callback).toHaveBeenCalledTimes(1);
    });

    it('receives deleted record', async () => {
      let deletedId: number | undefined;

      afterDelete('user', (_args, result) => {
        deletedId = result.id;
      });

      const user = await DB.users.create({ email: uniqueEmail() });
      await DB.users.withId(user.id).delete();

      expect(deletedId).toBe(user.id);
    });
  });

  // ==================== AFTER CHANGE (Column Hooks) ====================
  describe('afterChange', () => {
    it('triggers when column value changes', async () => {
      const callback = vi.fn();
      afterChange('user', 'status', callback);

      const user = await DB.users.create({ email: uniqueEmail(), status: 'pending' });
      await DB.users.withId(user.id).update({ status: 'active' });

      expect(callback).toHaveBeenCalledWith(
        'pending',
        'active',
        expect.objectContaining({ id: user.id }),
        expect.anything()
      );
    });

    it('does not trigger when column unchanged', async () => {
      const callback = vi.fn();
      afterChange('user', 'status', callback);

      const user = await DB.users.create({ email: uniqueEmail(), status: 'pending' });
      await DB.users.withId(user.id).update({ name: 'New Name' });

      expect(callback).not.toHaveBeenCalled();
    });

    it('does not trigger when value same', async () => {
      const callback = vi.fn();
      afterChange('user', 'status', callback);

      const user = await DB.users.create({ email: uniqueEmail(), status: 'pending' });
      await DB.users.withId(user.id).update({ status: 'pending' });

      expect(callback).not.toHaveBeenCalled();
    });

    it('triggers for updateMany', async () => {
      const callback = vi.fn();
      afterChange('user', 'status', callback);

      await DB.users.createMany([
        { email: 'a@test.com', status: 'pending' },
        { email: 'b@test.com', status: 'pending' },
      ]);

      await DB.users.where({ status: 'pending' }).updateMany({ status: 'active' });

      expect(callback).toHaveBeenCalledTimes(2);
    });
  });

  // ==================== AFTER UPSERT ====================
  describe('afterUpsert', () => {
    it('triggers after upsert create', async () => {
      const callback = vi.fn();
      afterUpsert('user', callback);

      await DB.users.where({ email: 'upsert@test.com' }).upsert({
        create: { email: 'upsert@test.com' },
        update: { name: 'Updated' },
      });

      expect(callback).toHaveBeenCalledTimes(1);
    });

    it('triggers after upsert update', async () => {
      const callback = vi.fn();
      afterUpsert('user', callback);

      await DB.users.create({ email: 'upsert@test.com' });

      await DB.users.where({ email: 'upsert@test.com' }).upsert({
        create: { email: 'upsert@test.com' },
        update: { name: 'Updated' },
      });

      expect(callback).toHaveBeenCalledTimes(1);
    });
  });

  // ==================== HOOK REGISTRY ====================
  describe('hookRegistry', () => {
    it('clearAll removes all hooks', async () => {
      const callback = vi.fn();
      beforeCreate('user', callback);
      afterCreate('user', callback);

      hookRegistry.clearAll();

      await DB.users.create({ email: uniqueEmail() });

      expect(callback).not.toHaveBeenCalled();
    });

    it('configure can disable column hooks', async () => {
      const callback = vi.fn();
      afterChange('user', 'status', callback);

      hookRegistry.configure({ enableColumnHooks: false });

      const user = await DB.users.create({ email: uniqueEmail(), status: 'pending' });
      await DB.users.withId(user.id).update({ status: 'active' });

      expect(callback).not.toHaveBeenCalled();
    });
  });

  // ==================== MULTIPLE HOOKS ====================
  describe('multiple hooks', () => {
    it('runs multiple hooks in order', async () => {
      const order: number[] = [];

      beforeCreate('user', () => { order.push(1); });
      beforeCreate('user', () => { order.push(2); });

      await DB.users.create({ email: uniqueEmail() });

      expect(order).toEqual([1, 2]);
    });

    it('runs before and after hooks', async () => {
      const order: string[] = [];

      beforeCreate('user', () => { order.push('before'); });
      afterCreate('user', () => { order.push('after'); });

      await DB.users.create({ email: uniqueEmail() });

      expect(order).toEqual(['before', 'after']);
    });
  });

  // ==================== AFTER CHANGE WITH includeFields ====================
  describe('afterChange with includeFields', () => {
    it('includes additional fields in record', async () => {
      let capturedRecord: any = null;

      afterChange('user', 'status', (_oldValue, _newValue, record) => {
        capturedRecord = record;
      }, { includeFields: ['email', 'name'] });

      const user = await DB.users.create({
        email: 'include@test.com',
        name: 'Test User',
        status: 'pending',
      });
      await DB.users.withId(user.id).update({ status: 'active' });

      expect(capturedRecord).not.toBeNull();
      expect(capturedRecord.id).toBe(user.id);
      expect(capturedRecord.status).toBe('active');
      // includeFields should be available
      expect(capturedRecord.email).toBe('include@test.com');
      expect(capturedRecord.name).toBe('Test User');
    });

    it('includeFields are fetched for updateMany', async () => {
      const records: any[] = [];

      afterChange('user', 'status', (_oldValue, _newValue, record) => {
        records.push(record);
      }, { includeFields: ['email'] });

      await DB.users.createMany([
        { email: 'a@test.com', name: 'A', status: 'pending' },
        { email: 'b@test.com', name: 'B', status: 'pending' },
      ]);

      await DB.users.where({ status: 'pending' }).updateMany({ status: 'active' });

      expect(records).toHaveLength(2);
      expect(records.every(r => r.email !== undefined)).toBe(true);
    });

    it('multiple afterChange hooks with different includeFields', async () => {
      let statusRecord: any = null;
      let nameRecord: any = null;

      afterChange('user', 'status', (_oldValue, _newValue, record) => {
        statusRecord = record;
      }, { includeFields: ['email'] });

      afterChange('user', 'name', (_oldValue, _newValue, record) => {
        nameRecord = record;
      }, { includeFields: ['status'] });

      const user = await DB.users.create({
        email: 'multi@test.com',
        name: 'Original',
        status: 'pending',
      });

      // Trigger both hooks
      await DB.users.withId(user.id).update({ status: 'active', name: 'Updated' });

      expect(statusRecord).not.toBeNull();
      expect(nameRecord).not.toBeNull();
    });
  });

  // ==================== HOOK REGISTRY CONFIGURATION ====================
  describe('hookRegistry configuration', () => {
    it('getConfig returns current configuration', () => {
      hookRegistry.configure({ enableColumnHooks: true, maxRefetch: 500, warnOnSkip: false });

      const config = hookRegistry.getConfig();

      expect(config.enableColumnHooks).toBe(true);
      expect(config.maxRefetch).toBe(500);
      expect(config.warnOnSkip).toBe(false);
    });

    it('configure merges with existing config', () => {
      hookRegistry.configure({ maxRefetch: 100 });
      hookRegistry.configure({ warnOnSkip: true });

      const config = hookRegistry.getConfig();

      expect(config.maxRefetch).toBe(100);
      expect(config.warnOnSkip).toBe(true);
    });

    it('clearAll resets config to defaults', () => {
      hookRegistry.configure({ maxRefetch: 50, warnOnSkip: false });
      hookRegistry.clearAll();

      const config = hookRegistry.getConfig();

      expect(config.maxRefetch).toBe(1000); // Default
      expect(config.warnOnSkip).toBe(true); // Default
    });

    it('hasColumnHooks returns true when column hooks registered', () => {
      expect(hookRegistry.hasColumnHooks('user')).toBe(false);

      afterChange('user', 'status', () => {});

      expect(hookRegistry.hasColumnHooks('user')).toBe(true);
    });

    it('hasColumnHooks returns false for unregistered models', () => {
      afterChange('user', 'status', () => {});

      expect(hookRegistry.hasColumnHooks('post')).toBe(false);
    });

    it('getRelevantFields returns fields with hooks', () => {
      afterChange('user', 'status', () => {});
      afterChange('user', 'name', () => {});

      const fields = hookRegistry.getRelevantFields('user');

      expect(fields).toHaveProperty('id'); // Always included
      expect(fields).toHaveProperty('status');
      expect(fields).toHaveProperty('name');
    });

    it('getRelevantFields includes includeFields', () => {
      afterChange('user', 'status', () => {}, { includeFields: ['email', 'createdAt'] });

      const fields = hookRegistry.getRelevantFields('user');

      expect(fields).toHaveProperty('id');
      expect(fields).toHaveProperty('status');
      expect(fields).toHaveProperty('email');
      expect(fields).toHaveProperty('createdAt');
    });
  });

  // ==================== VALUE COMPARISON IN COLUMN HOOKS ====================
  describe('afterChange value comparison', () => {
    it('handles Date comparison correctly', async () => {
      const callback = vi.fn();
      afterChange('user', 'updatedAt', callback);

      const user = await DB.users.create({ email: uniqueEmail() });

      // Wait a bit to ensure different timestamp
      await new Promise(r => setTimeout(r, 50));

      // Trigger an update that changes updatedAt
      await DB.users.withId(user.id).update({ name: 'New Name' });

      // updatedAt should have changed
      expect(callback).toHaveBeenCalled();
    });

    it('handles null to value transition', async () => {
      const callback = vi.fn();
      afterChange('user', 'name', callback);

      const user = await DB.users.create({ email: uniqueEmail(), name: null });
      await DB.users.withId(user.id).update({ name: 'Now Has Name' });

      expect(callback).toHaveBeenCalledWith(
        null,
        'Now Has Name',
        expect.anything(),
        expect.anything()
      );
    });

    it('handles value to null transition', async () => {
      const callback = vi.fn();
      afterChange('user', 'name', callback);

      const user = await DB.users.create({ email: uniqueEmail(), name: 'Has Name' });
      await DB.users.withId(user.id).update({ name: null });

      expect(callback).toHaveBeenCalledWith(
        'Has Name',
        null,
        expect.anything(),
        expect.anything()
      );
    });
  });

  // ==================== ASYNC HOOKS ====================
  describe('async hooks', () => {
    it('beforeCreate waits for async callback', async () => {
      let asyncCompleted = false;

      beforeCreate('user', async () => {
        await new Promise(r => setTimeout(r, 50));
        asyncCompleted = true;
      });

      await DB.users.create({ email: uniqueEmail() });

      expect(asyncCompleted).toBe(true);
    });

    it('afterCreate executes async callback', async () => {
      // Note: afterCreate hooks run in parallel and complete after the operation returns
      // Use a promise to properly track completion
      let resolvePromise: () => void;
      const hookCompleted = new Promise<void>(resolve => { resolvePromise = resolve; });

      let asyncResult: string | null = null;

      afterCreate('user', async (_args, result) => {
        await new Promise(r => setTimeout(r, 10));
        asyncResult = result.email;
        resolvePromise();
      });

      await DB.users.create({ email: 'async@test.com' });

      // Wait for the async hook to complete
      await hookCompleted;

      expect(asyncResult).toBe('async@test.com');
    });

    it('afterChange executes async callback', async () => {
      // Note: afterChange hooks run in parallel and complete after the operation returns
      // Use a promise to properly track completion
      let resolvePromise: () => void;
      const hookCompleted = new Promise<void>(resolve => { resolvePromise = resolve; });

      let asyncOldValue: string | null = null;
      let asyncNewValue: string | null = null;

      afterChange('user', 'status', async (oldValue, newValue) => {
        await new Promise(r => setTimeout(r, 10));
        asyncOldValue = oldValue;
        asyncNewValue = newValue;
        resolvePromise();
      });

      const user = await DB.users.create({ email: uniqueEmail(), status: 'pending' });
      await DB.users.withId(user.id).update({ status: 'active' });

      // Wait for the async hook to complete
      await hookCompleted;

      expect(asyncOldValue).toBe('pending');
      expect(asyncNewValue).toBe('active');
    });
  });
});
