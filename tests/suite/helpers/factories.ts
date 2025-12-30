/**
 * Factory functions that work with any DB instance.
 * Import these and bind to your project's DB in the adapter.
 */
import { uniqueEmail } from './base.js';

export interface User {
  id: number;
  email: string;
  name: string | null;
  status: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface Post {
  id: number;
  title: string;
  content: string | null;
  published: boolean;
  views: number;
  likes: number;
  authorId: number;
  createdAt: Date;
  updatedAt: Date;
}

interface UserCreateInput {
  email: string;
  name?: string;
  status?: string;
}

interface PostCreateInput {
  title: string;
  content?: string;
  authorId: number;
  published?: boolean;
}

export interface DB {
  users: { create: (data: UserCreateInput) => Promise<User> };
  posts: { create: (data: PostCreateInput) => Promise<Post> };
}

export function createFactories(DB: DB) {
  return {
    createUser: async (overrides: {
      email?: string;
      name?: string;
      status?: string;
    } = {}): Promise<User> => {
      return DB.users.create({
        email: overrides.email ?? uniqueEmail(),
        name: overrides.name ?? 'Test User',
        status: overrides.status ?? 'active',
      });
    },

    createUserWithPosts: async (
      userOverrides: { email?: string; name?: string } = {},
      postCount: number = 2
    ): Promise<{ user: User; posts: Post[] }> => {
      const user = await DB.users.create({
        email: userOverrides.email ?? uniqueEmail(),
        name: userOverrides.name ?? 'Test User',
      });

      const posts: Post[] = [];
      for (let i = 0; i < postCount; i++) {
        const post = await DB.posts.create({
          title: `Post ${i + 1}`,
          content: `Content for post ${i + 1}`,
          authorId: user.id,
          published: i === 0,
        });
        posts.push(post);
      }

      return { user, posts };
    },
  };
}
