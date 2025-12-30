/**
 * Test Data Factories for test-project-custom
 *
 * Provides factory functions for creating test data
 * with sensible defaults and customization options.
 */

import { db } from '../../prisma/db';

let userCounter = 0;
let postCounter = 0;

/**
 * Reset counters between test runs
 */
export function resetCounters(): void {
  userCounter = 0;
  postCounter = 0;
}

interface UserData {
  email?: string;
  name?: string | null;
}

interface PostData {
  title?: string;
  content?: string | null;
  published?: boolean;
  authorId: number;
}

/**
 * Create a single user with default or custom data
 */
export async function createUser(data: UserData = {}) {
  userCounter++;
  return db.user.create({
    data: {
      email: data.email ?? `user-${userCounter}-${Date.now()}@test.com`,
      name: data.name !== undefined ? data.name : `Test User ${userCounter}`,
    },
  });
}

/**
 * Create multiple users
 */
export async function createUsers(count: number, baseData: UserData = {}) {
  const users = [];
  for (let i = 0; i < count; i++) {
    users.push(await createUser(baseData));
  }
  return users;
}

/**
 * Create a post with default or custom data
 */
export async function createPost(data: PostData) {
  postCounter++;
  return db.post.create({
    data: {
      title: data.title ?? `Test Post ${postCounter}`,
      content: data.content,
      published: data.published ?? false,
      authorId: data.authorId,
    },
  });
}

/**
 * Create a user with associated posts
 */
export async function createUserWithPosts(
  userData: UserData = {},
  postCount = 2
) {
  const user = await createUser(userData);

  const posts = [];
  for (let i = 0; i < postCount; i++) {
    posts.push(
      await createPost({
        title: `Post ${i + 1} by ${user.name}`,
        authorId: user.id,
      })
    );
  }

  return { user, posts };
}
