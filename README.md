# Prisma Flare

A powerful TypeScript utilities package for Prisma ORM that provides a callback system and a query builder for chained operations.

## Performance

Prisma Flare adds **virtually zero overhead** to your queries. Our rigorous benchmarks show:

| Query Type | Prisma | Flare | Overhead |
|------------|--------|-------|----------|
| findFirst by ID | 0.083ms | 0.083ms | +0.25% |
| findFirst + include | 0.202ms | 0.202ms | +0.23% |
| COUNT with WHERE | 0.091ms | 0.091ms | +0.34% |
| Complex query (WHERE + ORDER + LIMIT + INCLUDE) | 0.331ms | 0.332ms | +0.38% |
| Custom model methods in include | 0.940ms | 0.942ms | +0.14% |

**Median overhead: 0.1% - 0.4%** (~0.001ms per query)

<details>
<summary><b>Benchmark Methodology</b></summary>

- **500 iterations** per test with **50 warmup iterations** for connection pool
- **Random alternating execution** between Prisma and Flare to eliminate ordering bias
- **Statistical measures**: median, p95, standard deviation (median used for comparison)
- **Test data**: 10 users, 200 posts with realistic field values
- **Database**: SQLite (results are consistent across PostgreSQL/MySQL)

What Flare adds:
- Object instantiation: ~0.001ms (FlareBuilder class)
- Method chaining: ~0.001ms per method call
- Model registry lookup: ~0.001ms (Map.get for includes with custom methods)

Run benchmarks yourself:
```bash
npm test -- --grep "Benchmark"
```
</details>

## Features

- **Plug & Play**: Works with any existing Prisma project
- **Flare Builder**: Elegant chainable query API for Prisma models
- **Auto-Generated Queries**: Automatically generates query classes based on your schema
- **Callback System**: Hooks for before/after operations (create, update, delete, upsert)
- **Column-Level Hooks**: Track changes to specific columns with `afterChange` callbacks
- **Extended Prisma Client**: Enhanced PrismaClient with additional utility methods
- **Type-Safe**: Full IntelliSense and compile-time type checking

## Installation

```bash
npm install prisma-flare
```

Ensure you have `@prisma/client` installed as a peer dependency.

### Prisma Version Compatibility

| Prisma Version | prisma-flare Support |
|----------------|----------------------|
| 5.x            | ✅ Full support      |
| 6.x            | ✅ Full support      |
| 7.x+           | ✅ Full support      |

prisma-flare automatically detects your Prisma version at runtime and uses the appropriate API:
- **Prisma ≤6**: Uses the legacy `$use()` middleware API
- **Prisma 7+**: Uses the new client extensions API

## Setup

### 1. Initialize your Client

Replace your standard `PrismaClient` with `ExtendedPrismaClient` in your database setup file (e.g., `src/db.ts` or `src/lib/prisma.ts`).

```typescript
// src/db.ts
import { ExtendedPrismaClient, registerHooks } from 'prisma-flare';

// Initialize hooks middleware (returns extended client for Prisma 7+)
const db = registerHooks(new ExtendedPrismaClient());

export { db };
```

> **Note**: In Prisma 7+, `registerHooks()` returns a new extended client instance. Always use the returned value. This pattern is backwards compatible with Prisma 6 as well.

### 2. Generate Query Classes

Run the generator to create type-safe query classes for your specific schema.

```bash
npx prisma-flare generate
```

By default, this will look for your `db` instance in `src/db` and output queries to `src/models`.

### 3. Configuration (Optional)

If your project structure is different, create a `prisma-flare.config.json` in your project root:

```json
{
  "modelsPath": "src/models",
  "dbPath": "src/lib/db",
  "envPath": ".env.local"
}
```

- `modelsPath`: Where to generate the query classes (defaults to `prisma/models`).
- `dbPath`: Path to the file exporting your `db` instance (relative to project root, defaults to `prisma/db`).
- `envPath`: Path to your environment file (optional, defaults to `.env`).
- `plurals`: Custom pluralization for model names (optional).

Example with custom plurals:

```json
{
  "plurals": {
    "Person": "people",
    "Equipment": "equipment"
  }
}
```

## Usage

### Flare Builder

Once generated, you can import the `DB` class to access chainable methods for your models.

```typescript
import DB from '.prisma-flare'; // Import from the generated module

// Chainable query builder with full type safety
const posts = await DB.posts
  .where({ published: true })
  .order({ createdAt: 'desc' })
  .limit(10)
  .include({ author: true })
  .findMany();

// Complex filtering made easy
const activeUsers = await DB.users
  .where({ isActive: true })
  .where({ role: 'ADMIN' })
  .count();

// Pagination
const { data, meta } = await DB.users.paginate(1, 15);

// Conditional queries
const search = 'John';
const users = await DB.users
  .when(!!search, (q) => q.where({ name: { contains: search } }))
  .findMany();

// Access raw Prisma Client instance
const rawDb = DB.instance;
```

### Transactions

Prisma Flare provides a powerful wrapper around Prisma's interactive transactions, allowing you to use the fluent `from()` API within a transaction scope.

```typescript
// Simple transaction
const result = await DB.instance.transaction(async (tx) => {
  // Create a user
  const user = await tx.from('User').create({
    email: 'tx-user@example.com',
    name: 'Transaction User',
  });

  // Create a related post using the user's ID
  const post = await tx.from('Post').create({
    title: 'Transaction Post',
    content: 'Content',
    authorId: user.id,
  });

  return { user, post };
});

// Complex logic with conditional operations
await DB.instance.transaction(async (tx) => {
  const existing = await tx.from('User').where({ email: 'check@example.com' }).findFirst();

  if (!existing) {
    await tx.from('User').create({
      email: 'check@example.com',
      name: 'New User'
    });
  } else {
    await tx.from('User').withId(existing.id).update({
      lastLogin: new Date()
    });
  }
});
```

### Callhooks & Middleware

Define hooks to run logic before or after database operations. You can use `before` hooks for validation or data modification.

```typescript
import { beforeCreate, afterCreate, afterChange } from 'prisma-flare';

// Validation: Prevent creating users with invalid emails
beforeCreate('User', async (args) => {
  if (!args.data.email.includes('@')) {
    throw new Error('Invalid email address');
  }
});

// Run after a User is created
afterCreate('User', async (args, result) => {
  console.log('New user created:', result.email);
  await sendWelcomeEmail(result.email);
});

// Run when the 'published' field on Post changes
afterChange('Post', 'published', async (oldValue, newValue, record) => {
  if (!oldValue && newValue) {
    console.log(`Post "${record.title}" was published!`);
  }
});
```

#### Hook Configuration

Configure hook behavior globally, especially useful for performance tuning:

```typescript
import { hookRegistry } from 'prisma-flare';

// Disable column hooks globally (for performance-critical paths)
hookRegistry.configure({ enableColumnHooks: false });

// Limit re-fetching on large updateMany operations
// Column hooks will be skipped if more than 1000 records are affected
hookRegistry.configure({ maxRefetch: 1000 });

// Disable the warning when hooks are skipped
hookRegistry.configure({ warnOnSkip: false });

// Check current configuration
const config = hookRegistry.getConfig();
```

**Configuration options:**

| Option | Default | Description |
|--------|---------|-------------|
| `enableColumnHooks` | `true` | Enable/disable all column-level hooks |
| `maxRefetch` | `1000` | Max records to re-fetch for column hooks. Prevents expensive operations on large `updateMany`. Set to `Infinity` to disable limit. |
| `warnOnSkip` | `true` | Log warning when hooks are skipped due to limits |

#### Advanced Hook Registration

For more control over hook registration, prisma-flare exports additional utilities:

```typescript
import { 
  registerHooks,           // Auto-detects Prisma version (recommended)
  registerHooksLegacy,     // Force legacy $use API (Prisma ≤6 only)
  createHooksExtension     // Get raw extension for manual use
} from 'prisma-flare';

// Option 1: Auto-detect (recommended)
const db = registerHooks(new ExtendedPrismaClient());

// Option 2: Manual extension (Prisma 7+ only)
import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient().$extends(createHooksExtension(new PrismaClient()));
```

## CLI Utilities

Prisma Flare comes with a suite of CLI tools to manage your database workflow. It supports **PostgreSQL** and **SQLite** out of the box, and is extensible for other databases.

```bash
npx prisma-flare generate   # Generate query classes from schema
npx prisma-flare create     # Create database
npx prisma-flare drop       # Drop database
npx prisma-flare migrate    # Run migrations
npx prisma-flare reset      # Reset database
npx prisma-flare seed       # Seed database
```

### Custom Database Adapters

You can add support for other databases by registering a custom adapter.

```typescript
import { dbAdapterRegistry, DatabaseAdapter } from 'prisma-flare';

const myAdapter: DatabaseAdapter = {
  name: 'my-db',
  matches: (url) => url.startsWith('mydb://'),
  create: async (url) => { /* custom create logic */ },
  drop: async (url) => { /* custom drop logic */ }
};

dbAdapterRegistry.register(myAdapter);
```

## Custom Query Methods

You can extend the generated query classes with custom methods for your domain-specific needs. Simply add methods to your query class that use the built-in `where()` method to build conditions.

```typescript
// src/models/Post.ts
import { db } from '../core/db';
import { FlareBuilder } from 'prisma-flare';

export default class Post extends FlareBuilder<'post'> {
  constructor() {
    super(db.post);
  }

  // Filter published posts
  published(): this {
    this.where({ published: true });
    return this;
  }

  // Filter draft posts
  drafts(): this {
    this.where({ published: false });
    return this;
  }

  // Search by title (contains)
  withTitle(title: string): this {
    this.where({ title: { contains: title } });
    return this;
  }

  // Filter by author ID
  withAuthorId(authorId: number): this {
    this.where({ authorId });
    return this;
  }

  // Get recent posts
  recent(days: number): this {
    const date = new Date();
    date.setDate(date.getDate() - days);
    this.where({ createdAt: { gte: date } });
    return this;
  }
}
```

Then use your custom methods in queries:

```typescript
import DB from './src/models';

// Use custom methods with full chainability
const recentPublished = await DB.post
  .published()
  .recent(7)
  .order({ createdAt: 'desc' })
  .findMany();

const authorPosts = await DB.post
  .withAuthorId(123)
  .withTitle('TypeScript')
  .include({ author: true })
  .findMany();
```

**Tips for Custom Methods:**
- Always return `this` to maintain chainability
- Use descriptive names with prefixes like `with*` for filters
- Leverage Prisma's query operators (`contains`, `gte`, `lte`, etc.)
- Keep methods focused on a single responsibility

## Flare Builder API Reference

### Query Building Methods

These methods build and customize your query before execution.

#### `where(condition)`
Adds a WHERE condition to the query with full type safety from Prisma.

```typescript
// Single condition
const users = await DB.users.where({ isActive: true }).findMany();

// Multiple conditions (merged together)
const users = await DB.users
  .where({ isActive: true })
  .where({ role: 'ADMIN' })
  .findMany();

// Complex conditions with operators
const users = await DB.users.where({
  email: { contains: 'example.com' },
  age: { gte: 18 }
}).findMany();
```

### Boolean Logic (AND/OR/NOT)

Prisma Flare provides explicit control over boolean logic. Understanding how conditions compose is critical for correct queries.

#### How `where()` chaining works

Multiple `where()` calls are composed using **AND** logic:

```typescript
// These are equivalent:
DB.users.where({ status: 'active' }).where({ role: 'admin' })
// → { AND: [{ status: 'active' }, { role: 'admin' }] }
```

#### `orWhere(condition)` - ⚠️ Advanced

`orWhere()` wraps the **entire accumulated where** in an OR:

```typescript
DB.users.where({ status: 'active' }).orWhere({ role: 'admin' })
// → { OR: [{ status: 'active' }, { role: 'admin' }] }
```

**⚠️ Beware:** Adding more conditions after `orWhere` can be confusing:

```typescript
DB.users
  .where({ status: 'active' })  // A
  .orWhere({ role: 'admin' })   // OR(A, B)
  .where({ verified: true })    // AND(OR(A, B), C)
// Result: (status='active' OR role='admin') AND verified=true
```

For complex logic, prefer `whereGroup()` for explicit control.

#### `whereGroup(callback)` - Recommended for complex logic

Creates an explicit group that's AND-ed with the existing where:

```typescript
// (status = 'active') AND (role = 'admin' OR role = 'moderator')
const users = await DB.users
  .where({ status: 'active' })
  .whereGroup(qb => qb
    .where({ role: 'admin' })
    .orWhere({ role: 'moderator' })
  )
  .findMany();
```

#### `orWhereGroup(callback)`

Creates an explicit group that's OR-ed with the existing where:

```typescript
// (status = 'active') OR (role = 'admin' AND verified = true)
const users = await DB.users
  .where({ status: 'active' })
  .orWhereGroup(qb => qb
    .where({ role: 'admin' })
    .where({ verified: true })
  )
  .findMany();
```

#### NOT conditions

Use Prisma's `NOT` operator inside `where()`:

```typescript
// Active users who are NOT banned
const users = await DB.users
  .where({ status: 'active' })
  .where({ NOT: { role: 'banned' } })
  .findMany();
```

#### Quick Reference

| Pattern | Result |
|---------|--------|
| `.where(A).where(B)` | `A AND B` |
| `.where(A).orWhere(B)` | `A OR B` |
| `.where(A).orWhere(B).where(C)` | `(A OR B) AND C` |
| `.where(A).whereGroup(q => q.where(B).orWhere(C))` | `A AND (B OR C)` |
| `.where(A).orWhereGroup(q => q.where(B).where(C))` | `A OR (B AND C)` |

**Rule of thumb:** For anything beyond simple AND chains or single OR, use `whereGroup()`/`orWhereGroup()`.

#### `withId(id)`
Filters records by ID. Throws an error if no ID is provided.

```typescript
const user = await DB.users.withId(123).findFirst();
const post = await DB.posts.withId('uuid-string').findUnique();
```

#### `select(fields)`
Selects specific fields to retrieve. Reduces data transfer and improves query performance.

```typescript
// Select only name and email
const users = await DB.users
  .select({ id: true, name: true, email: true })
  .findMany();

// Combine with other conditions
const admin = await DB.users
  .where({ role: 'ADMIN' })
  .select({ id: true, email: true })
  .findFirst();
```

#### `include(relation)` or `include(relation, callback)`
Includes related records in the query. Can be called multiple times for nested relations.

```typescript
// Include all default fields from the relation
const posts = await DB.posts
  .include('author')
  .findMany();

// Include with custom query on the relation
const posts = await DB.posts
  .include('author', (q) => 
    q.select({ id: true, name: true, email: true })
  )
  .findMany();

// Multiple includes
const posts = await DB.posts
  .include('author')
  .include('comments', (q) => q.limit(5))
  .findMany();

// Nested includes
const posts = await DB.posts
  .include('author', (q) => 
    q.include('profile')
  )
  .findMany();
```

#### `order(orderBy)`
Adds ordering to the query results.

```typescript
// Single field ascending
const users = await DB.users.order({ createdAt: 'asc' }).findMany();

// Single field descending
const posts = await DB.posts.order({ published: 'desc' }).findMany();

// Multiple fields
const comments = await DB.comments
  .order({ likes: 'desc', createdAt: 'asc' })
  .findMany();
```

#### `first(key?)` and `last(key?)`
Convenience methods to get the first or last record. Automatically sets limit to 1.

```typescript
// Get the first user (by createdAt)
const first = await DB.users.first().findFirst();

// Get the last post (by date)
const latest = await DB.posts.last('publishedAt').findFirst();

// Chain with where conditions
const first = await DB.posts
  .where({ published: true })
  .first()
  .findFirst();
```

#### `limit(n)`
Limits the number of records returned.

```typescript
const topTen = await DB.posts.limit(10).findMany();
```

#### `skip(offset)`
Skips a number of records (useful for custom pagination).

```typescript
const page = await DB.users.skip(20).limit(10).findMany();
```

#### `distinct(fields)`
Returns only distinct records based on the specified fields.

```typescript
// Get distinct user emails
const distinctEmails = await DB.users
  .distinct({ email: true })
  .select({ email: true })
  .findMany();
```

#### `groupBy(fields)`
Groups results by the specified fields (aggregation).

```typescript
const grouped = await DB.posts
  .groupBy({ authorId: true })
  .findMany();
```

#### `having(condition)`
Adds a HAVING clause for aggregate queries.

```typescript
const authors = await DB.posts
  .groupBy({ authorId: true })
  .having({ id: { _count: { gt: 5 } } })
  .findMany();
```

#### `getQuery()`
Returns the current internal query object. Useful for debugging or passing to raw operations.

```typescript
const query = DB.users.where({ active: true }).getQuery();
console.log(query);
```

### Execution Methods

These methods execute the query and return results.

#### `findMany()`
Returns all records matching the query conditions.

```typescript
const allUsers = await DB.users.findMany();
const activeUsers = await DB.users.where({ isActive: true }).findMany();
const limited = await DB.users.limit(10).findMany();
```

#### `findFirst()`
Returns the first record matching the query, or `null` if none found.

```typescript
const user = await DB.users.where({ email: 'user@example.com' }).findFirst();
if (user) {
  console.log('User found:', user.name);
}
```

#### `findFirstOrThrow()`
Like `findFirst()`, but throws a `Prisma.NotFoundError` if no record is found.

```typescript
try {
  const user = await DB.users
    .where({ email: 'admin@example.com' })
    .findFirstOrThrow();
} catch (error) {
  console.error('User not found');
}
```

#### `findUnique()`
Finds a record by a unique constraint (typically the ID). Returns `null` if not found.

```typescript
const user = await DB.users.withId(123).findUnique();
```

#### `findUniqueOrThrow()`
Like `findUnique()`, but throws an error if the record is not found.

```typescript
const user = await DB.users.withId(123).findUniqueOrThrow();
```

#### `create(data)`
Creates a new record with the provided data. Triggers any registered hooks.

```typescript
const newUser = await DB.users.create({
  email: 'new@example.com',
  name: 'New User'
});
```

#### `createMany(data)`
Creates multiple records in a single operation. More efficient than individual creates.

```typescript
const result = await DB.posts.createMany({
  data: [
    { title: 'Post 1', content: 'Content 1', authorId: 1 },
    { title: 'Post 2', content: 'Content 2', authorId: 1 }
  ]
});
console.log(`Created ${result.count} posts`);
```

#### `update(data)`
Updates a single record. Requires a unique constraint (typically id) in the where condition.

```typescript
const updated = await DB.users
  .withId(123)
  .update({ name: 'Updated Name' });
```

#### `updateMany(data)`
Updates multiple records matching the current conditions.

```typescript
const result = await DB.users
  .where({ status: 'inactive' })
  .updateMany({ lastLogin: new Date() });
console.log(`Updated ${result.count} users`);
```

#### `delete()`
Deletes a single record. Requires a unique constraint in the where condition.

```typescript
const deleted = await DB.posts.withId(123).delete();
```

#### `deleteMany()`
Deletes multiple records matching the current conditions.

```typescript
const result = await DB.posts
  .where({ published: false })
  .deleteMany();
console.log(`Deleted ${result.count} drafts`);
```

#### `upsert(args)`
Updates a record if it exists, otherwise creates a new one.

```typescript
const result = await DB.users
  .where({ email: 'user@example.com' })
  .upsert({
    create: { email: 'user@example.com', name: 'New User' },
    update: { lastLogin: new Date() }
  });
```

### Aggregation Methods

These methods perform calculations on your data.

#### `count()`
Counts records matching the current query.

```typescript
const totalUsers = await DB.users.count();
const activeCount = await DB.users.where({ isActive: true }).count();
```

#### `sum(field)`
Sums a numeric field across matching records.

```typescript
const totalSales = await DB.orders.where({ status: 'completed' }).sum('amount');
```

#### `avg(field)`
Calculates the average of a numeric field.

```typescript
const avgPrice = await DB.products.avg('price');
```

#### `min(field)`
Finds the minimum value of a field.

```typescript
const oldest = await DB.users.min('createdAt');
```

#### `max(field)`
Finds the maximum value of a field.

```typescript
const latest = await DB.posts.max('publishedAt');
```

### Utility Methods

These methods provide additional functionality for querying and data processing.

#### `only(field)`
Selects and returns only a specific field value from the first matching record.

```typescript
const email = await DB.users.withId(123).only('email');
// Returns: 'user@example.com' or null
```

#### `pluck(field)`
Extracts a specific field from all matching records as an array.

```typescript
const emails = await DB.users.where({ isActive: true }).pluck('email');
// Returns: ['user1@example.com', 'user2@example.com', ...]
```

#### `exists(key?)`
Checks if any record exists matching the current query.

```typescript
const hasAdmins = await DB.users.where({ role: 'ADMIN' }).exists();

// Check for existence of a specific field
const hasEmail = await DB.users.where({ id: 123 }).exists('email');
```

#### `paginate(page, perPage)`
Returns paginated results with metadata for easy navigation.

```typescript
const result = await DB.users.where({ isActive: true }).paginate(1, 15);

console.log(result.data);        // Array of users
console.log(result.meta);        // Pagination metadata

// Meta structure
{
  total: 150,           // Total records matching query
  lastPage: 10,         // Total number of pages
  currentPage: 1,       // Current page number
  perPage: 15,          // Records per page
  prev: null,           // Previous page number or null
  next: 2               // Next page number or null
}

// Fetch next page
const nextPage = await DB.users
  .where({ isActive: true })
  .paginate(result.meta.next, 15);
```

#### `when(condition, callback)`
Conditionally applies query operations based on a boolean or function.

```typescript
const search = req.query.search;
const role = req.query.role;

const users = await DB.users
  .when(!!search, (q) => q.where({ name: { contains: search } }))
  .when(!!role, (q) => q.where({ role }))
  .findMany();

// With function condition
const users = await DB.users
  .when(() => isAdmin(user), (q) => q.select({ id: true, email: true, role: true }))
  .findMany();
```

#### `chunk(size, callback)`
Processes large datasets in chunks to avoid memory issues.

```typescript
await DB.posts.chunk(100, async (posts) => {
  // Process each chunk of 100 posts
  for (const post of posts) {
    await sendNotification(post.authorId);
  }
});
```

#### `clone()`
Creates an independent copy of the current query builder.

```typescript
const baseQuery = DB.posts.where({ published: true });

const recent = baseQuery.clone().order({ createdAt: 'desc' }).findMany();
const popular = baseQuery.clone().order({ likes: 'desc' }).findMany();
```

## License

ISC
