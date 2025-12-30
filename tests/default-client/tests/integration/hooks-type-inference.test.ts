/**
 * Hooks Type Inference Tests
 *
 * Tests for verifying that AfterHookCallback properly infers types from Prisma models.
 * This includes:
 * - Basic field type inference
 * - Type safety for model-specific callbacks
 * - Runtime behavior with `include` (relations)
 * - Type inference across different operations (create, update, delete, upsert)
 */

import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import {
  afterCreate,
  afterUpdate,
  afterDelete,
  afterUpsert,
  hookRegistry,
} from 'prisma-flare';
import type { AfterHookCallback } from 'prisma-flare';
import { DB } from 'prisma-flare/generated';
import { cleanDatabase, disconnectPrisma } from '../helpers/database.js';
import { createUser } from '../helpers/factories.js';

describe('Hooks Type Inference', () => {
  beforeEach(async () => {
    await cleanDatabase();
    hookRegistry.clearAll();
  });

  afterAll(async () => {
    hookRegistry.clearAll();
    await disconnectPrisma();
  });

  /**
   * ============================================
   * BASIC TYPE INFERENCE
   * ============================================
   */
  describe('Basic Type Inference', () => {
    it('should infer result type for afterCreate with user model', async () => {
      const capturedResults: Array<{
        id: number;
        email: string;
        name: string | null;
        status: string;
      }> = [];

      // The callback should have properly typed `result` parameter
      afterCreate('user', (args, result) => {
        // These fields should be available with correct types
        capturedResults.push({
          id: result.id,
          email: result.email,
          name: result.name,
          status: result.status,
        });
      });

      const user = await DB.users.create({ email: 'typed@test.com', name: 'Typed User' });

      expect(capturedResults).toHaveLength(1);
      expect(capturedResults[0]).toEqual({
        id: user.id,
        email: 'typed@test.com',
        name: 'Typed User',
        status: 'pending',
      });
    });

    it('should infer result type for afterUpdate with user model', async () => {
      const capturedResults: Array<{
        id: number;
        email: string;
        name: string | null;
        status: string;
      }> = [];

      afterUpdate('user', (args, result) => {
        capturedResults.push({
          id: result.id,
          email: result.email,
          name: result.name,
          status: result.status,
        });
      });

      const user = await createUser({ name: 'Original', status: 'pending' });
      await DB.users.withId(user.id).update({ name: 'Updated', status: 'active' });

      expect(capturedResults).toHaveLength(1);
      expect(capturedResults[0]).toEqual({
        id: user.id,
        email: user.email,
        name: 'Updated',
        status: 'active',
      });
    });

    it('should infer result type for afterDelete with user model', async () => {
      const capturedResults: Array<{
        id: number;
        email: string;
        name: string | null;
      }> = [];

      afterDelete('user', (args, result) => {
        capturedResults.push({
          id: result.id,
          email: result.email,
          name: result.name,
        });
      });

      const user = await createUser({ email: 'delete@test.com', name: 'To Delete' });
      await DB.users.withId(user.id).delete();

      expect(capturedResults).toHaveLength(1);
      expect(capturedResults[0]).toEqual({
        id: user.id,
        email: 'delete@test.com',
        name: 'To Delete',
      });
    });

    it('should infer result type for afterUpsert with user model', async () => {
      const capturedResults: Array<{
        id: number;
        email: string;
        name: string | null;
        status: string;
      }> = [];

      afterUpsert('user', (args, result) => {
        capturedResults.push({
          id: result.id,
          email: result.email,
          name: result.name,
          status: result.status,
        });
      });

      // Create via upsert using FlareClient
      await DB.users.where({ email: 'upsert@test.com' }).upsert({
        create: { email: 'upsert@test.com', name: 'Created' },
        update: { name: 'Updated' },
      });

      expect(capturedResults).toHaveLength(1);
      expect(capturedResults[0].email).toBe('upsert@test.com');
      expect(capturedResults[0].name).toBe('Created');
    });

    it('should infer result type for afterCreate with post model', async () => {
      const capturedResults: Array<{
        id: number;
        title: string;
        content: string | null;
        published: boolean;
        views: number;
        likes: number;
        authorId: number;
      }> = [];

      afterCreate('post', (args, result) => {
        capturedResults.push({
          id: result.id,
          title: result.title,
          content: result.content,
          published: result.published,
          views: result.views,
          likes: result.likes,
          authorId: result.authorId,
        });
      });

      const user = await createUser();
      await DB.posts.create({
        title: 'Test Post',
        content: 'Content here',
        authorId: user.id,
      });

      expect(capturedResults).toHaveLength(1);
      expect(capturedResults[0]).toMatchObject({
        title: 'Test Post',
        content: 'Content here',
        published: false,
        views: 0,
        likes: 0,
        authorId: user.id,
      });
    });
  });

  /**
   * ============================================
   * DATE FIELD TYPE INFERENCE
   * ============================================
   */
  describe('Date Field Type Inference', () => {
    it('should infer Date types for createdAt and updatedAt', async () => {
      let capturedCreatedAt: Date | undefined;
      let capturedUpdatedAt: Date | undefined;

      afterCreate('user', (args, result) => {
        capturedCreatedAt = result.createdAt;
        capturedUpdatedAt = result.updatedAt;
      });

      await DB.users.create({ email: 'dates@test.com' });

      expect(capturedCreatedAt).toBeInstanceOf(Date);
      expect(capturedUpdatedAt).toBeInstanceOf(Date);
    });

    it('should have updated timestamps after update', async () => {
      let capturedUpdatedAt: Date | undefined;

      afterUpdate('user', (args, result) => {
        capturedUpdatedAt = result.updatedAt;
      });

      const user = await createUser();
      const originalUpdatedAt = user.updatedAt;

      // Wait a bit to ensure timestamp changes
      await new Promise((resolve) => setTimeout(resolve, 10));

      await DB.users.withId(user.id).update({ name: 'Updated Name' });

      expect(capturedUpdatedAt).toBeInstanceOf(Date);
      expect(capturedUpdatedAt!.getTime()).toBeGreaterThanOrEqual(originalUpdatedAt.getTime());
    });
  });

  /**
   * ============================================
   * NULLABLE FIELD TYPE INFERENCE
   * ============================================
   */
  describe('Nullable Field Type Inference', () => {
    it('should handle nullable fields correctly', async () => {
      const results: Array<{ name: string | null; content: string | null }> = [];

      afterCreate('user', (args, result) => {
        results.push({ name: result.name, content: null });
      });

      afterCreate('post', (args, result) => {
        results.push({ name: null, content: result.content });
      });

      // Create user with null name
      await DB.users.create({ email: 'nullname@test.com', name: null });

      // Create post with null content
      const user = await createUser();
      await DB.posts.create({ title: 'No Content', content: null, authorId: user.id });

      expect(results).toHaveLength(3); // 2 users (one from createUser) + 1 post
      expect(results[0].name).toBeNull();
    });

    it('should transition from null to value', async () => {
      let capturedName: string | null = 'initial';

      afterUpdate('user', (args, result) => {
        capturedName = result.name;
      });

      const user = await DB.users.create({ email: 'transition@test.com', name: null });
      expect(user.name).toBeNull();

      await DB.users.withId(user.id).update({ name: 'Now Has Name' });

      expect(capturedName).toBe('Now Has Name');
    });
  });

  /**
   * ============================================
   * INCLUDE/RELATIONS RUNTIME BEHAVIOR
   * ============================================
   */
  describe('Include/Relations Runtime Behavior', () => {
    it('should have access to included relations with nested create', async () => {
      let capturedResult: any = null;

      afterCreate('user', (args, result) => {
        capturedResult = result;
      });

      // Nested create with include - fully typed, no `as any` needed
      const user = await DB.users.include('posts').create({
        email: 'nestedcreate@test.com',
        name: 'With Posts',
        posts: {
          create: [
            { title: 'Post 1' },
            { title: 'Post 2' },
          ],
        },
      });

      expect(capturedResult).not.toBeNull();
      expect(capturedResult.id).toBe(user.id);
      expect(capturedResult.posts).toBeDefined();
      expect(capturedResult.posts).toHaveLength(2);
      expect(capturedResult.posts[0].title).toBe('Post 1');
    });

    it('should have access to included relations at runtime in afterUpdate', async () => {
      let capturedResult: any = null;

      afterUpdate('user', (args, result) => {
        capturedResult = result;
      });

      // Create user with nested posts
      const user = await DB.users.create({
        email: 'updateinclude@test.com',
        name: 'Original',
        posts: { create: [{ title: 'Existing Post' }] },
      });

      // Update with include - the result will have posts
      await DB.users.withId(user.id).include('posts').update({ name: 'Updated' });

      expect(capturedResult).not.toBeNull();
      expect(capturedResult.name).toBe('Updated');
      expect(capturedResult.posts).toBeDefined();
      expect(capturedResult.posts).toHaveLength(1);
    });

    it('should have access to author relation in post callback', async () => {
      let capturedResult: any = null;

      afterCreate('post', (args, result) => {
        capturedResult = result;
      });

      const user = await createUser({ name: 'Author Name' });

      // Create post with include to get author in result
      await DB.posts.include('author').create({
        title: 'Post with Author',
        authorId: user.id,
      });

      expect(capturedResult.title).toBe('Post with Author');
      expect(capturedResult.author).toBeDefined();
      expect(capturedResult.author.name).toBe('Author Name');
    });

    it('should work with select instead of include', async () => {
      let capturedResult: any = null;

      afterUpdate('user', (args, result) => {
        capturedResult = result;
      });

      const user = await createUser();

      // Update with select (only specific fields)
      await DB.users.withId(user.id).select({ id: true, email: true, name: true }).update({ name: 'Selected Update' });

      expect(capturedResult.id).toBe(user.id);
      expect(capturedResult.email).toBe(user.email);
      expect(capturedResult.name).toBe('Selected Update');
      // When using select, only selected fields are present
      expect(capturedResult.status).toBeUndefined();
    });

    it('should include filtered relations', async () => {
      let capturedResult: any = null;

      afterUpdate('user', (args, result) => {
        capturedResult = result;
      });

      // Create user with mixed published/draft posts using nested create
      const user = await DB.users.create({
        email: 'filtered@test.com',
        name: 'Has Posts',
        posts: {
          create: [
            { title: 'Published', published: true },
            { title: 'Draft', published: false },
          ],
        },
      });

      // Update with filtered include
      await DB.users
        .withId(user.id)
        .include('posts', (posts) => posts.where({ published: true }))
        .update({ name: 'Updated' });

      expect(capturedResult.name).toBe('Updated');
      expect(capturedResult.posts).toBeDefined();
      expect(capturedResult.posts).toHaveLength(1);
      expect(capturedResult.posts[0].title).toBe('Published');
    });

    it('should work with include on findFirst', async () => {
      // Create user with post using nested create
      const user = await DB.users.create({
        email: 'findinclude@test.com',
        name: 'With Post',
        posts: {
          create: [{ title: 'Test Post' }],
        },
      });

      const result = await DB.users.withId(user.id).include('posts').findFirst();

      expect(result).not.toBeNull();
      expect(result!.posts).toBeDefined();
      expect(result!.posts).toHaveLength(1);
      expect(result!.posts[0].title).toBe('Test Post');
    });
  });

  /**
   * ============================================
   * TYPE-SAFE CALLBACK SIGNATURES
   * ============================================
   */
  describe('Type-Safe Callback Signatures', () => {
    it('should allow explicitly typed callbacks', async () => {
      // Explicitly typed callback
      const typedCallback: AfterHookCallback<'user'> = (args, result) => {
        // result should be typed as RecordType<'user'>
        const id: number = result.id;
        const email: string = result.email;
        const name: string | null = result.name;
        const status: string = result.status;

        expect(typeof id).toBe('number');
        expect(typeof email).toBe('string');
        expect(name === null || typeof name === 'string').toBe(true);
        expect(typeof status).toBe('string');
      };

      afterCreate('user', typedCallback);

      await DB.users.create({ email: 'explicit@test.com' });
    });

    it('should allow accessing all model fields in post callback', async () => {
      const callback: AfterHookCallback<'post'> = (args, result) => {
        // All post fields should be accessible
        expect(typeof result.id).toBe('number');
        expect(typeof result.title).toBe('string');
        expect(result.content === null || typeof result.content === 'string').toBe(true);
        expect(typeof result.published).toBe('boolean');
        expect(typeof result.views).toBe('number');
        expect(typeof result.likes).toBe('number');
        expect(typeof result.authorId).toBe('number');
        expect(result.createdAt).toBeInstanceOf(Date);
        expect(result.updatedAt).toBeInstanceOf(Date);
      };

      afterCreate('post', callback);

      const user = await createUser();
      await DB.posts.create({
        title: 'Typed Post',
        content: 'Content',
        authorId: user.id,
      });
    });
  });

  /**
   * ============================================
   * ARGS PARAMETER INSPECTION
   * ============================================
   */
  describe('Args Parameter', () => {
    it('should receive the original args in create callback', async () => {
      let capturedArgs: any = null;

      afterCreate('user', (args, result) => {
        capturedArgs = args;
      });

      await DB.users.create({
        email: 'argstest@test.com',
        name: 'Args Test',
        status: 'active',
      });

      expect(capturedArgs).not.toBeNull();
      expect(capturedArgs.data).toBeDefined();
      expect(capturedArgs.data.email).toBe('argstest@test.com');
      expect(capturedArgs.data.name).toBe('Args Test');
      expect(capturedArgs.data.status).toBe('active');
    });

    it('should receive where clause in update callback', async () => {
      let capturedArgs: any = null;

      afterUpdate('user', (args, result) => {
        capturedArgs = args;
      });

      const user = await createUser();
      await DB.users.withId(user.id).update({ name: 'Updated' });

      expect(capturedArgs.where).toBeDefined();
      expect(capturedArgs.where.id).toBe(user.id);
      expect(capturedArgs.data.name).toBe('Updated');
    });

    it('should receive where clause in delete callback', async () => {
      let capturedArgs: any = null;

      afterDelete('user', (args, result) => {
        capturedArgs = args;
      });

      const user = await createUser();
      await DB.users.withId(user.id).delete();

      expect(capturedArgs.where).toBeDefined();
      expect(capturedArgs.where.id).toBe(user.id);
    });
  });

  /**
   * ============================================
   * PRISMA CLIENT PARAMETER
   * ============================================
   */
  describe('Prisma Client Parameter', () => {
    it('should receive prisma client as third parameter', async () => {
      let receivedPrisma: any = null;

      afterCreate('user', (args, result, prisma) => {
        receivedPrisma = prisma;
      });

      await DB.users.create({ email: 'prismatest@test.com' });

      expect(receivedPrisma).not.toBeNull();
      expect(typeof receivedPrisma.user).toBe('object');
      expect(typeof receivedPrisma.post).toBe('object');
    });

    it('should be able to use prisma client for additional queries', async () => {
      let userCount = 0;

      afterCreate('user', async (args, result, prisma) => {
        // Query using the prisma client
        userCount = await prisma.user.count();
      });

      await DB.users.create({ email: 'count1@test.com' });

      // Wait for async callback
      await new Promise((resolve) => setTimeout(resolve, 50));

      expect(userCount).toBe(1);
    });
  });

  /**
   * ============================================
   * MULTIPLE HOOKS SAME MODEL
   * ============================================
   */
  describe('Multiple Hooks Same Model', () => {
    it('should pass same typed result to all hooks', async () => {
      const results: Array<{ id: number; email: string }> = [];

      afterCreate('user', (args, result) => {
        results.push({ id: result.id, email: result.email });
      });

      afterCreate('user', (args, result) => {
        results.push({ id: result.id, email: result.email });
      });

      afterCreate('user', (args, result) => {
        results.push({ id: result.id, email: result.email });
      });

      const user = await DB.users.create({ email: 'multi@test.com' });

      expect(results).toHaveLength(3);
      results.forEach((r) => {
        expect(r.id).toBe(user.id);
        expect(r.email).toBe('multi@test.com');
      });
    });
  });

  /**
   * ============================================
   * CROSS-MODEL TYPE SAFETY
   * ============================================
   */
  describe('Cross-Model Type Safety', () => {
    it('should have different types for different models', async () => {
      const userResults: Array<{ email: string }> = [];
      const postResults: Array<{ title: string }> = [];

      afterCreate('user', (args, result) => {
        // result.email exists on User
        userResults.push({ email: result.email });
      });

      afterCreate('post', (args, result) => {
        // result.title exists on Post
        postResults.push({ title: result.title });
      });

      const user = await DB.users.create({ email: 'crossmodel@test.com' });
      await DB.posts.create({ title: 'Cross Model Post', authorId: user.id });

      expect(userResults).toHaveLength(1);
      expect(userResults[0].email).toBe('crossmodel@test.com');

      expect(postResults).toHaveLength(1);
      expect(postResults[0].title).toBe('Cross Model Post');
    });
  });

  /**
   * ============================================
   * REAL-WORLD SCENARIOS
   * ============================================
   */
  describe('Real-World Scenarios', () => {
    it('should support audit logging pattern with typed fields', async () => {
      interface AuditEntry {
        action: string;
        modelId: number;
        modelEmail: string;
        timestamp: Date;
      }

      const auditLog: AuditEntry[] = [];

      afterCreate('user', (args, result) => {
        auditLog.push({
          action: 'CREATE',
          modelId: result.id,
          modelEmail: result.email,
          timestamp: result.createdAt,
        });
      });

      afterUpdate('user', (args, result) => {
        auditLog.push({
          action: 'UPDATE',
          modelId: result.id,
          modelEmail: result.email,
          timestamp: result.updatedAt,
        });
      });

      const user = await DB.users.create({ email: 'audit@test.com' });
      await DB.users.withId(user.id).update({ name: 'Audited' });

      expect(auditLog).toHaveLength(2);
      expect(auditLog[0].action).toBe('CREATE');
      expect(auditLog[0].modelEmail).toBe('audit@test.com');
      expect(auditLog[1].action).toBe('UPDATE');
    });

    it('should support notification pattern with related data', async () => {
      const notifications: Array<{ type: string; data: any }> = [];

      afterCreate('post', (args, result) => {
        notifications.push({
          type: 'NEW_POST',
          data: {
            postId: result.id,
            title: result.title,
            authorId: result.authorId,
          },
        });
      });

      afterUpdate('post', (args, result) => {
        if (result.published) {
          notifications.push({
            type: 'POST_PUBLISHED',
            data: {
              postId: result.id,
              title: result.title,
            },
          });
        }
      });

      const user = await createUser();
      const post = await DB.posts.create({ title: 'Draft Post', authorId: user.id });

      await DB.posts.withId(post.id).update({ published: true });

      expect(notifications).toHaveLength(2);
      expect(notifications[0].type).toBe('NEW_POST');
      expect(notifications[1].type).toBe('POST_PUBLISHED');
    });

    it('should support analytics tracking with typed metrics', async () => {
      interface PostMetrics {
        id: number;
        views: number;
        likes: number;
        engagement: number;
      }

      const metricsHistory: PostMetrics[] = [];

      afterUpdate('post', (args, result) => {
        metricsHistory.push({
          id: result.id,
          views: result.views,
          likes: result.likes,
          engagement: result.views > 0 ? result.likes / result.views : 0,
        });
      });

      const user = await createUser();
      const post = await DB.posts.create({ title: 'Tracked Post', authorId: user.id });

      await DB.posts.withId(post.id).update({ views: 100, likes: 10 });
      await DB.posts.withId(post.id).update({ views: 200, likes: 30 });

      expect(metricsHistory).toHaveLength(2);
      expect(metricsHistory[0].engagement).toBe(0.1);
      expect(metricsHistory[1].engagement).toBe(0.15);
    });
  });
});
