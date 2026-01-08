# Prisma Flare

A powerful TypeScript utilities package for Prisma ORM that provides a callback system and a query builder for chained operations.

## Features

- **Plug & Play**: Works with any existing Prisma project
- **Flare Builder**: Elegant chainable query API for Prisma models
- **Auto-Generated Queries**: Automatically generates query classes based on your schema
- **Callback System**: Hooks for before/after operations (create, update, delete) and column-level changes
- **Type-Safe**: Full IntelliSense and compile-time type checking
- **Zero Overhead**: ~0.1-0.4% overhead per query (~0.001ms)

## Installation

```bash
npm install prisma-flare
```

### Compatibility

| Prisma Version | Generator Provider | Support |
|----------------|-------------------|---------|
| 5.x - 7.x | `prisma-client-js` | ✅ |
| 7.x+ | `prisma-client` | ✅ |

## Quick Start

### 1. Generate and Initialize

```bash
# Generate prisma-flare client (run after prisma generate)
npx prisma-flare generate
```

```typescript
// prisma/db.ts
import './callbacks';
import { FlareClient } from 'prisma-flare/client';

export const db = new FlareClient();
```

> **Note**: For advanced setups (custom Prisma output, monorepos), see [Configuration](docs/configuration.md).

### 2. Generate Query Classes

Query classes are auto-generated based on your Prisma schema:

```bash
npx prisma-flare generate
```

### 3. Use the Fluent API

```typescript
import { DB } from 'prisma-flare/generated';

// Chainable queries with full type safety
const posts = await DB.posts
  .where({ published: true })
  .order({ createdAt: 'desc' })
  .limit(10)
  .include('author')
  .findMany();

// Pagination
const { data, meta } = await DB.users.paginate(1, 15);

// Conditional queries
const users = await DB.users
  .when(!!search, (q) => q.where({ name: { contains: search } }))
  .findMany();
```

### 4. Define Callbacks

```typescript
// prisma/callbacks/user.ts
import { beforeCreate, afterChange } from 'prisma-flare-generated';

beforeCreate('user', async (args) => {
  if (!args.data.email.includes('@')) {
    throw new Error('Invalid email');
  }
});

afterChange('post', 'published', async (oldValue, newValue, record) => {
  if (!oldValue && newValue) {
    await notifySubscribers(record);
  }
});
```

> **Note**: Always import hooks from `prisma-flare-generated` for proper type inference. This module is created by `npx prisma-flare generate` and provides types specific to your Prisma schema.

## Documentation

- **[API Reference](docs/api-reference.md)** - Complete FlareBuilder API documentation
- **[Hooks & Callbacks](docs/hooks.md)** - Lifecycle hooks and column-level change tracking
- **[Configuration](docs/configuration.md)** - Config options, custom paths, and CLI commands
- **[How It Works](docs/how-it-works.md)** - Architecture and type generation internals
- **[Development](docs/development.md)** - Testing, contributing, and project structure

## Custom Prisma Output

prisma-flare fully supports custom Prisma output paths. Just run `npx prisma-flare generate` and import from `prisma-flare/client`:

```prisma
generator client {
  provider = "prisma-client-js"
  output   = "./generated/client"
}
```

```typescript
// The recommended import - works with any Prisma configuration
import { FlareClient, FlareBuilder } from 'prisma-flare/client';

export const db = new FlareClient();
```

For the new `prisma-client` provider (Prisma 7+), you can also import from the generated `flare.ts`:

```typescript
import { FlareClient } from './generated/flare';
import { PrismaPg } from '@prisma/adapter-pg';

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
export const db = new FlareClient({ adapter });
```

See [Configuration](docs/configuration.md#new-provider-prisma-client---prisma-7) for full setup.

## Transactions

```typescript
await DB.instance.transaction(async (tx) => {
  const user = await tx.from('user').create({
    email: 'new@example.com',
    name: 'New User',
  });

  await tx.from('post').create({
    title: 'First Post',
    authorId: user.id,
  });
});
```

## Performance

| Query Type | Overhead |
|------------|----------|
| findFirst by ID | +0.25% |
| findFirst + include | +0.23% |
| COUNT with WHERE | +0.34% |
| Complex query | +0.38% |

**Median overhead: 0.1-0.4%** (~0.001ms per query)

## License

ISC
