/**
 * Nested Include Type Tests (Type-only)
 *
 * These tests verify that nested include callbacks have correctly typed builders.
 * The tests use expectTypeOf which is checked at compile time by vitest --typecheck.
 *
 * If RelationModelName returns `never`, these tests will fail because:
 * - FlareBuilder<never> won't have the expected methods
 * - IncludeKey<never> will be `never`, so .include() won't accept any relation names
 */

import { describe, it, expectTypeOf, assertType } from 'vitest';
import { DB } from 'prisma-flare/generated';
import type { FlareBuilder, ModelName } from 'prisma-flare';

describe('Nested Include Callback Types', () => {

  it('include callback parameter should be FlareBuilder<"post"> not FlareBuilder<never>', () => {
    // When including posts on users, the callback should receive FlareBuilder<'post'>
    // If RelationModelName returns `never`, this would be FlareBuilder<never>
    DB.users.include('posts', (postsBuilder) => {
      // This should be FlareBuilder<'post'>, not FlareBuilder<never>
      // If it's FlareBuilder<never>, these type assertions will fail
      expectTypeOf(postsBuilder.where).toBeFunction();
      expectTypeOf(postsBuilder.order).toBeFunction();
      expectTypeOf(postsBuilder.include).toBeFunction();

      // The include method should accept 'author' as a valid relation name for 'post'
      // If postsBuilder is FlareBuilder<never>, IncludeKey<never> would be never
      // and 'author' wouldn't be assignable to never
      return postsBuilder.include('author');
    });
  });

  it('nested include callback should be properly typed for belongs-to relation', () => {
    DB.posts.include('author', (authorBuilder) => {
      // author is a User, so authorBuilder should be FlareBuilder<'user'>
      // Users have 'posts' relation
      expectTypeOf(authorBuilder.where).toBeFunction();
      expectTypeOf(authorBuilder.include).toBeFunction();

      // FlareBuilder<'user'> should accept 'posts' as include key
      return authorBuilder.include('posts');
    });
  });

  it('double nested callback should maintain type safety', () => {
    DB.users.include('posts', (postsBuilder) => {
      // postsBuilder is FlareBuilder<'post'>
      return postsBuilder.include('author', (authorBuilder) => {
        // authorBuilder should be FlareBuilder<'user'>
        // Check that author's posts can be included
        return authorBuilder.include('posts');
      });
    });
  });

  it('callback builder should have where() typed for the correct model', () => {
    DB.users.include('posts', (postsBuilder) => {
      // postsBuilder.where should accept PostWhereInput
      // If it's FlareBuilder<never>, WhereInput<never> would be never
      return postsBuilder.where({ published: true });
    });
  });

  it('callback builder should have order() typed for the correct model', () => {
    DB.users.include('posts', (postsBuilder) => {
      // postsBuilder.order should accept PostOrderByInput
      return postsBuilder.order({ title: 'asc' });
    });
  });
});
