/**
 * Hooks and Callbacks Integration Tests
 */

import { describe, it, expect, beforeEach, afterEach, afterAll, vi } from 'vitest';
import { beforeCreate, afterCreate, afterUpdate, afterChange, hookRegistry } from 'prisma-flare';
import { DB } from 'prisma-flare/generated';
import { cleanDatabase, disconnectPrisma } from './helpers.js';

describe('Hooks Integration Tests', () => {
  beforeEach(async () => {
    await cleanDatabase();
    // Clear all hooks before each test
    hookRegistry.clearAll();
  });

  afterAll(async () => {
    await disconnectPrisma();
  });

  describe('beforeCreate Hook', () => {
    it('should execute before creating a user', async () => {
      const callback = vi.fn();

      beforeCreate('user', callback);

      await DB.users.create({
        email: 'test@example.com',
        name: 'Test User',
      });

      expect(callback).toHaveBeenCalled();
      expect(callback).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            email: 'test@example.com',
          }),
        }),
        expect.anything() // Prisma Client
      );
    });

    it('should block creation if hook throws error', async () => {
      beforeCreate('user', () => {
        throw new Error('Validation Failed');
      });

      await expect(
        DB.users.create({
          email: 'fail@example.com',
          name: 'Fail User',
        })
      ).rejects.toThrow('Validation Failed');

      // Verify user was NOT created
      const user = await DB.users.where({ email: 'fail@example.com' }).findFirst();
      expect(user).toBeNull();
    });

    it('should use before hook for validation', async () => {
      // Example: Validate email format
      beforeCreate('user', (args) => {
        if (!args.data.email.includes('@')) {
          throw new Error('Invalid email format');
        }
      });

      // Should fail
      await expect(
        DB.users.create({
          email: 'invalid-email',
          name: 'Invalid User',
        })
      ).rejects.toThrow('Invalid email format');

      // Should succeed
      await expect(
        DB.users.create({
          email: 'valid@example.com',
          name: 'Valid User',
        })
      ).resolves.toBeDefined();
    });
  });

  describe('afterCreate Hook', () => {
    it('should execute after creating a user', async () => {
      const callback = vi.fn();

      afterCreate('user', callback);

      const user = await DB.users.create({
        email: 'test@example.com',
        name: 'Test User',
      });

      expect(callback).toHaveBeenCalled();
      expect(callback).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            email: 'test@example.com',
          }),
        }),
        expect.objectContaining({
          id: user.id,
          email: 'test@example.com',
        }),
        expect.anything() // Prisma Client
      );
    });
  });

  describe('afterUpdate Hook', () => {
    it('should execute after updating a user', async () => {
      const callback = vi.fn();

      const user = await DB.users.create({
        email: 'test@example.com',
        name: 'Test User',
      });

      afterUpdate('user', callback);

      await DB.users.withId(user.id).update({
        name: 'Updated Name'
      });

      expect(callback).toHaveBeenCalled();
    });
  });

  describe('afterChange Hook', () => {
    it('should detect when a specific field changes', async () => {
      const callback = vi.fn();

      const user = await DB.users.create({
        email: 'test@example.com',
        name: 'Test User',
      });

      afterChange('user', 'name', callback);

      await DB.users.where({ id: user.id }).update({
        name: 'New Name'
      });

      expect(callback).toHaveBeenCalled();
      expect(callback).toHaveBeenCalledWith(
        'Test User',
        'New Name',
        expect.objectContaining({ id: user.id }),
        expect.anything() // Prisma Client
      );
    });

    it('should trigger correctly on updateMany even if filter field changes', async () => {
      const callback = vi.fn();

      // Create 2 users with status 'pending'
      await DB.users.createMany([
        { email: 'u1@test.com', name: 'U1', status: 'pending' },
        { email: 'u2@test.com', name: 'U2', status: 'pending' },
      ]);

      afterChange('user', 'status', callback);

      // Update them to 'active' - this changes the field we might filter by
      await DB.users.where({ status: 'pending' }).updateMany({
        status: 'active'
      });

      // Should be called twice (once for each user)
      expect(callback).toHaveBeenCalledTimes(2);
      expect(callback).toHaveBeenCalledWith(
        'pending',
        'active',
        expect.anything(),
        expect.anything()
      );
    });

    it('should not trigger when field does not change', async () => {
      const callback = vi.fn();

      const user = await DB.users.create({
        email: 'test@example.com',
        name: 'Test User',
      });

      afterChange('user', 'name', callback);

      await DB.users.where({ id: user.id }).update({
        email: 'newemail@example.com'
      });

      expect(callback).not.toHaveBeenCalled();
    });

    it('should trigger afterChange even when update uses select (re-fetch fix)', async () => {
      const callback = vi.fn();

      const user = await DB.users.create({
        email: 'test@example.com',
        name: 'Original Name',
        status: 'pending',
      });

      afterChange('user', 'status', callback);

      // Update with select that doesn't include the 'status' field
      // Previously this would fail because result only contained 'id' and 'email'
      await DB.users
        .withId(user.id)
        .select({ id: true, email: true })
        .update({ status: 'active' });

      // Hook should still fire because we re-fetch the relevant fields
      expect(callback).toHaveBeenCalled();
      expect(callback).toHaveBeenCalledWith(
        'pending',
        'active',
        expect.objectContaining({ id: user.id }),
        expect.anything()
      );
    });
  });

  describe('Multiple Hooks', () => {
    it('should execute multiple hooks in sequence', async () => {
      const beforeCallback = vi.fn();
      const afterCallback = vi.fn();

      beforeCreate('user', beforeCallback);
      afterCreate('user', afterCallback);

      await DB.users.create({
        email: 'test@example.com',
        name: 'Test User',
      });

      expect(beforeCallback).toHaveBeenCalled();
      expect(afterCallback).toHaveBeenCalled();
    });
  });

  describe('Hook Configuration', () => {
    it('should allow disabling column hooks globally', async () => {
      const callback = vi.fn();

      const user = await DB.users.create({
        email: 'test@example.com',
        name: 'Test User',
        status: 'pending',
      });

      afterChange('user', 'status', callback);

      // Disable column hooks
      hookRegistry.configure({ enableColumnHooks: false });

      await DB.users.where({ id: user.id }).update({
        status: 'active'
      });

      // Hook should NOT fire because column hooks are disabled
      expect(callback).not.toHaveBeenCalled();
    });

    it('should respect maxRefetch limit', async () => {
      const callback = vi.fn();
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => { });

      // Create more users than the limit
      await DB.users.createMany([
        { email: 'u1@test.com', name: 'U1', status: 'pending' },
        { email: 'u2@test.com', name: 'U2', status: 'pending' },
        { email: 'u3@test.com', name: 'U3', status: 'pending' },
      ]);

      afterChange('user', 'status', callback);

      // Set very low maxRefetch
      hookRegistry.configure({ maxRefetch: 2, warnOnSkip: true });

      await DB.users.where({ status: 'pending' }).updateMany({
        status: 'active'
      });

      // Hook should NOT fire because record count exceeds limit
      expect(callback).not.toHaveBeenCalled();
      expect(warnSpy).toHaveBeenCalledWith(
        expect.stringContaining('Skipping column hooks')
      );

      warnSpy.mockRestore();
    });

    it('should run column hooks when under maxRefetch limit', async () => {
      const callback = vi.fn();

      await DB.users.createMany([
        { email: 'u1@test.com', name: 'U1', status: 'pending' },
        { email: 'u2@test.com', name: 'U2', status: 'pending' },
      ]);

      afterChange('user', 'status', callback);

      // Set maxRefetch higher than record count
      hookRegistry.configure({ maxRefetch: 10 });

      await DB.users.where({ status: 'pending' }).updateMany({
        status: 'active'
      });

      // Hook should fire for both records
      expect(callback).toHaveBeenCalledTimes(2);
    });

    it('should expose current configuration', () => {
      hookRegistry.configure({ maxRefetch: 5000, enableColumnHooks: true });

      const config = hookRegistry.getConfig();

      expect(config.maxRefetch).toBe(5000);
      expect(config.enableColumnHooks).toBe(true);
    });

    it('should skip column hooks when __flare.skipColumnHooks is true', async () => {
      const callback = vi.fn();

      const user = await DB.users.create({
        email: 'test@example.com',
        name: 'Test User',
        status: 'pending',
      });

      afterChange('user', 'status', callback);

      // Use per-call skip option
      await DB.users.where({ id: user.id }).update({
        status: 'active',
        // Per-call skip (this gets stripped before Prisma sees it)
        __flare: { skipColumnHooks: true }
      } as any); // Need 'as any' since __flare isn't in the Prisma type

      // Hook should NOT fire because we skipped it for this call
      expect(callback).not.toHaveBeenCalled();
    });

    it('should still run regular hooks when column hooks are skipped per-call', async () => {
      const columnCallback = vi.fn();
      const updateCallback = vi.fn();

      const user = await DB.users.create({
        email: 'test@example.com',
        name: 'Test User',
        status: 'pending',
      });

      afterChange('user', 'status', columnCallback);
      afterUpdate('user', updateCallback);

      // Use per-call skip for column hooks only
      await DB.users.where({ id: user.id }).update({
        status: 'active',
        __flare: { skipColumnHooks: true }
      } as any);

      // Column hook should NOT fire
      expect(columnCallback).not.toHaveBeenCalled();
      // Regular update hook should still fire
      expect(updateCallback).toHaveBeenCalled();
    });
  });
});
