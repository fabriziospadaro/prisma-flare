# Prisma Flare

A powerful TypeScript utilities package for Prisma ORM that provides a callback system and a query builder for chained operations.

## Features

- **Plug & Play**: Works with any existing Prisma project
- **Query Builder**: Elegant chainable query API for Prisma models
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

## Setup

### 1. Initialize your Client

Replace your standard `PrismaClient` with `ExtendedPrismaClient` in your database setup file (e.g., `src/db.ts` or `src/lib/prisma.ts`).

```typescript
// src/db.ts
import { ExtendedPrismaClient, registerHooks } from 'prisma-flare';

const db = new ExtendedPrismaClient();

// Initialize hooks middleware
registerHooks(db);

export { db };
```

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

- `modelsPath`: Where to generate the query classes (defaults to `src/models`).
- `dbPath`: Path to the file exporting your `db` instance (relative to project root).
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

### Query Builder

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
import QueryBuilder from '../core/queryBuilder';

export default class Post extends QueryBuilder<'post'> {
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

## Query Builder Methods

- `where(condition)` - Add WHERE conditions
- `whereId(id)` - Filter by ID
- `order(orderBy)` - Add ORDER BY
- `first(key)` - Get first record
- `last(key)` - Get last record
- `limit(n)` - Limit results
- `skip(n)` - Skip records
- `select(fields)` - Select specific fields
- `include(relations)` - Include relations
- `exists()` - Check if record exists
- `only(field)` - Get single field value
- `pluck(field)` - Extract specific field values as an array
- `paginate(page, perPage)` - Get paginated results with metadata
- `when(condition, callback)` - Conditionally apply query operations
- `chunk(size, callback)` - Process large datasets in chunks
- `clone()` - Clone the query builder
- `count()`, `sum(field)`, `avg(field)`, `min(field)`, `max(field)` - Aggregations
- `findMany()`, `findFirst()`, `findFirstOrThrow()`, `findUnique()`, `findUniqueOrThrow()`, `create()`, `update()`, `delete()` - Execute queries

## License

ISC
