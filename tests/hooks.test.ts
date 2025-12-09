/**
 * Hooks and Callbacks Integration Tests
 */

import { describe, it, expect, beforeEach, afterEach, afterAll, vi } from 'vitest';
import { beforeCreate, afterCreate, afterUpdate, afterChange } from '../src';
import { db } from '../src/core/db';
import hookRegistry from '../src/core/hookRegistry';
import { cleanDatabase, disconnectPrisma } from './helpers';

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

      await db.query('user').create({
        data: { email: 'test@example.com', name: 'Test User' },
      });

      expect(callback).toHaveBeenCalled();
      expect(callback).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            email: 'test@example.com',
          }),
        })
      );
    });
  });

  describe('afterCreate Hook', () => {
    it('should execute after creating a user', async () => {
      const callback = vi.fn();
      
      afterCreate('user', callback);

      const user = await db.query('user').create({
        data: { email: 'test@example.com', name: 'Test User' },
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
        })
      );
    });
  });

  describe('afterUpdate Hook', () => {
    it('should execute after updating a user', async () => {
      const callback = vi.fn();
      
      const user = await db.query('user').create({
        data: { email: 'test@example.com', name: 'Test User' },
      });

      afterUpdate('user', callback);

      await db.query('user').update({
        where: { id: user.id },
        data: { name: 'Updated Name' },
      });

      expect(callback).toHaveBeenCalled();
    });
  });

  describe('afterChange Hook', () => {
    it('should detect when a specific field changes', async () => {
      const callback = vi.fn();
      
      const user = await db.query('user').create({
        data: { email: 'test@example.com', name: 'Test User' },
      });

      afterChange('user', 'name', callback);

      await db.query('user').update({
        where: { id: user.id },
        data: { name: 'New Name' },
      });

      expect(callback).toHaveBeenCalled();
      expect(callback).toHaveBeenCalledWith(
        'Test User',
        'New Name',
        expect.objectContaining({ id: user.id })
      );
    });

    it('should not trigger when field does not change', async () => {
      const callback = vi.fn();
      
      const user = await db.query('user').create({
        data: { email: 'test@example.com', name: 'Test User' },
      });

      afterChange('user', 'name', callback);

      await db.query('user').update({
        where: { id: user.id },
        data: { email: 'newemail@example.com' },
      });

      expect(callback).not.toHaveBeenCalled();
    });
  });

  describe('Multiple Hooks', () => {
    it('should execute multiple hooks in sequence', async () => {
      const beforeCallback = vi.fn();
      const afterCallback = vi.fn();
      
      beforeCreate('user', beforeCallback);
      afterCreate('user', afterCallback);

      await db.query('user').create({
        data: { email: 'test@example.com', name: 'Test User' },
      });

      expect(beforeCallback).toHaveBeenCalled();
      expect(afterCallback).toHaveBeenCalled();
    });
  });
});
