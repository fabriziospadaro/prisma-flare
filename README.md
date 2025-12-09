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
import { ExtendedPrismaClient, addMiddleware } from 'prisma-flare';

const db = new ExtendedPrismaClient();

// Initialize hooks middleware
addMiddleware(db);

export { db };
```

### 2. Generate Query Classes

Run the generator to create type-safe query classes for your specific schema.

```bash
npx prisma-flare generate
```

By default, this will look for your `db` instance in `src/db` and output queries to `src/queries`.

### 3. Configuration (Optional)

If your project structure is different, create a `prisma-flare.config.json` in your project root:

```json
{
  "queriesPath": "src/queries",
  "dbPath": "src/lib/db"
}
```

- `queriesPath`: Where to generate the query classes.
- `dbPath`: Path to the file exporting your `db` instance (relative to project root).

## Usage

### Query Builder

Once generated, you can import the `Query` class to access chainable methods for your models.

```typescript
import Query from './src/queries'; // Path to your generated queries

// Chainable query builder with full type safety
const posts = await Query.post
  .where({ published: true })
  .order({ createdAt: 'desc' })
  .limit(10)
  .include({ author: true })
  .findMany();

// Complex filtering made easy
const activeUsers = await Query.user
  .where({ isActive: true })
  .where({ role: 'ADMIN' })
  .count();

// Pagination
const { data, meta } = await Query.user.paginate(1, 15);

// Conditional queries
const search = 'John';
const users = await Query.user
  .when(!!search, (q) => q.where({ name: { contains: search } }))
  .findMany();
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

Prisma Flare comes with a suite of CLI tools to manage your database workflow.

```bash
npx prisma-flare generate   # Generate query classes from schema
npx prisma-flare db:create  # Create database
npx prisma-flare db:drop    # Drop database
npx prisma-flare db:migrate # Run migrations
npx prisma-flare db:reset   # Reset database
npx prisma-flare db:seed    # Seed database
```

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
