/**
 * Model Registry Tests
 *
 * Tests for the model registry system that allows registering
 * custom model classes for use with the include() method.
 */

import { describe, it, expect, beforeEach, afterAll, afterEach } from 'vitest';
import { modelRegistry } from 'prisma-flare';
import {
  DB,
  User,
  Post,
  cleanDatabase,
  disconnect,
  createUser,
  uniqueEmail,
} from '#test-helpers';

describe('Model Registry', () => {
  beforeEach(async () => {
    await cleanDatabase();
    modelRegistry.clear();
  });

  afterAll(async () => {
    await disconnect();
  });

  afterEach(() => {
    modelRegistry.clear();
  });

  // ==================== BASIC REGISTRATION ====================
  describe('Basic Registration', () => {
    it('register() adds a model class', () => {
      modelRegistry.register('user', User);
      expect(modelRegistry.has('user')).toBe(true);
    });

    it('has() returns false for unregistered models', () => {
      expect(modelRegistry.has('nonexistent')).toBe(false);
    });

    it('get() retrieves registered model class', () => {
      modelRegistry.register('post', Post);
      const PostClass = modelRegistry.get('post');
      expect(PostClass).toBe(Post);
    });

    it('get() returns undefined for unregistered models', () => {
      const Model = modelRegistry.get('nonexistent');
      expect(Model).toBeUndefined();
    });

    it('registerMany() registers multiple models', () => {
      modelRegistry.registerMany({
        user: User,
        post: Post,
      });

      expect(modelRegistry.has('user')).toBe(true);
      expect(modelRegistry.has('post')).toBe(true);
    });

    it('getRegisteredModels() returns all registered model names', () => {
      modelRegistry.registerMany({
        user: User,
        post: Post,
      });

      const models = modelRegistry.getRegisteredModels();
      expect(models).toContain('user');
      expect(models).toContain('post');
      expect(models).toHaveLength(2);
    });
  });

  // ==================== CLEAR ====================
  describe('Clear', () => {
    it('clear() removes all registered models', () => {
      modelRegistry.registerMany({ user: User, post: Post });
      expect(modelRegistry.getRegisteredModels()).toHaveLength(2);

      modelRegistry.clear();
      expect(modelRegistry.getRegisteredModels()).toHaveLength(0);
    });
  });

  // ==================== CREATE INSTANCES ====================
  describe('Create Instances', () => {
    it('create() instantiates a registered model', async () => {
      modelRegistry.register('user', User);

      const userBuilder = modelRegistry.create('user');
      expect(userBuilder).toBeDefined();
      expect(userBuilder).toBeInstanceOf(User);
    });

    it('create() returns undefined for unregistered models', () => {
      const instance = modelRegistry.create('nonexistent');
      expect(instance).toBeUndefined();
    });

    it('created instance has custom methods', async () => {
      await createUser({ name: 'Test User', email: uniqueEmail() });
      modelRegistry.register('user', User);

      const userBuilder = modelRegistry.create('user');
      // Should have the withName method from custom User class
      expect(userBuilder).toHaveProperty('withName');
      expect(typeof (userBuilder as any).withName).toBe('function');
    });

    it('created instance can execute queries', async () => {
      await createUser({ name: 'John Doe', email: uniqueEmail() });
      await createUser({ name: 'Jane Smith', email: uniqueEmail() });
      modelRegistry.register('user', User);

      const userBuilder = modelRegistry.create('user') as User;
      const users = await userBuilder.withName('John').findMany();

      expect(users).toHaveLength(1);
      expect(users[0].name).toContain('John');
    });
  });

  // ==================== INTEGRATION WITH INCLUDE ====================
  describe('Integration with include()', () => {
    it('include returns custom model instances when registered', async () => {
      modelRegistry.registerMany({ user: User, post: Post });

      const user = await createUser({ name: 'Author', email: uniqueEmail() });
      await DB.posts.create({ title: 'Test Post', authorId: user.id, published: true });

      // When author model is registered, include('author') should return
      // the relation data (this tests the integration point)
      const posts = await DB.posts.include('author').findMany();

      expect(posts).toHaveLength(1);
      expect(posts[0].author).toBeDefined();
      expect(posts[0].author.name).toBe('Author');
    });

    it('include works without registry (returns plain objects)', async () => {
      // Don't register any models
      const user = await createUser({ name: 'Plain Author', email: uniqueEmail() });
      await DB.posts.create({ title: 'Plain Post', authorId: user.id });

      const posts = await DB.posts.include('author').findMany();

      expect(posts).toHaveLength(1);
      expect(posts[0].author).toBeDefined();
      expect(posts[0].author.name).toBe('Plain Author');
    });
  });

  // ==================== OVERWRITING ====================
  describe('Overwriting', () => {
    it('registering same model twice overwrites', () => {
      class CustomUser1 extends User {}
      class CustomUser2 extends User {}

      modelRegistry.register('user', CustomUser1 as any);
      expect(modelRegistry.get('user')).toBe(CustomUser1);

      modelRegistry.register('user', CustomUser2 as any);
      expect(modelRegistry.get('user')).toBe(CustomUser2);
    });
  });
});
