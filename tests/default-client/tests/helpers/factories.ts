/**
 * Test Data Factories
 * Utilities for creating test data with sensible defaults
 */

import { DB } from 'prisma-flare/generated';

// Counter for unique values
let counter = 0;

/**
 * Generate a unique identifier for test data
 */
export function uniqueId(): number {
  return ++counter;
}

/**
 * Generate a unique email
 */
export function uniqueEmail(prefix = 'user'): string {
  return `${prefix}-${uniqueId()}@test.com`;
}

/**
 * Reset the counter (call in beforeEach if needed)
 */
export function resetCounter(): void {
  counter = 0;
}

// ========================================
// User Factory
// ========================================

export interface UserData {
  email?: string;
  name?: string;
  status?: string;
  createdAt?: Date;
}

/**
 * Create a single user with defaults
 */
export async function createUser(data: UserData = {}) {
  return DB.users.create({
    email: data.email ?? uniqueEmail(),
    name: data.name ?? `Test User ${uniqueId()}`,
    status: data.status ?? 'pending',
    ...(data.createdAt && { createdAt: data.createdAt }),
  });
}

/**
 * Create multiple users with defaults
 */
export async function createUsers(count: number, overrides: Partial<UserData> = {}) {
  const users = [];
  for (let i = 0; i < count; i++) {
    users.push(await createUser(overrides));
  }
  return users;
}

/**
 * Create users with specific statuses for testing filters
 */
export async function createUsersWithStatuses(statuses: string[]) {
  return Promise.all(
    statuses.map((status) => createUser({ status }))
  );
}

/**
 * Create users with specific names for testing searches
 */
export async function createUsersWithNames(names: string[]) {
  return Promise.all(
    names.map((name) => createUser({ name }))
  );
}

// ========================================
// Post Factory
// ========================================

export interface PostData {
  title?: string;
  content?: string;
  published?: boolean;
  views?: number;
  likes?: number;
  authorId: number;
  createdAt?: Date;
}

/**
 * Create a single post with defaults
 */
export async function createPost(data: PostData) {
  return DB.posts.create({
    title: data.title ?? `Test Post ${uniqueId()}`,
    content: data.content ?? 'Test content',
    published: data.published ?? false,
    views: data.views ?? 0,
    likes: data.likes ?? 0,
    authorId: data.authorId,
    ...(data.createdAt && { createdAt: data.createdAt }),
  });
}

/**
 * Create multiple posts for a user
 */
export async function createPosts(authorId: number, count: number, overrides: Partial<Omit<PostData, 'authorId'>> = {}) {
  const posts = [];
  for (let i = 0; i < count; i++) {
    posts.push(await createPost({ authorId, ...overrides }));
  }
  return posts;
}

/**
 * Create a user with posts
 */
export async function createUserWithPosts(userData: UserData = {}, postCount = 3) {
  const user = await createUser(userData);
  const posts = await createPosts(user.id, postCount);
  return { user, posts };
}

/**
 * Create a user with published and draft posts
 */
export async function createUserWithMixedPosts(userData: UserData = {}) {
  const user = await createUser(userData);
  const publishedPosts = await createPosts(user.id, 2, { published: true });
  const draftPosts = await createPosts(user.id, 2, { published: false });
  return { user, publishedPosts, draftPosts };
}

// ========================================
// Bulk Data Factories
// ========================================

/**
 * Create a realistic dataset for pagination testing
 */
export async function createPaginationDataset(userCount = 5, postsPerUser = 10) {
  const users = await createUsers(userCount);
  const allPosts = [];

  for (const user of users) {
    const posts = await createPosts(user.id, postsPerUser);
    allPosts.push(...posts);
  }

  return { users, posts: allPosts };
}

/**
 * Create data for aggregation testing
 */
export async function createAggregationDataset() {
  const users = await Promise.all([
    createUser({ name: 'Alice', status: 'active' }),
    createUser({ name: 'Bob', status: 'active' }),
    createUser({ name: 'Charlie', status: 'inactive' }),
  ]);

  // Create posts with varying views and likes
  const posts = [];
  for (const user of users) {
    posts.push(
      await createPost({ authorId: user.id, views: 100, likes: 10, published: true }),
      await createPost({ authorId: user.id, views: 200, likes: 20, published: true }),
      await createPost({ authorId: user.id, views: 50, likes: 5, published: false })
    );
  }

  return { users, posts };
}
