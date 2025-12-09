# Prismaroids

A powerful TypeScript utilities package for Prisma ORM that provides a callback system and a query builder for chained operations.

## Features

- **Full TypeScript Support**: Complete type safety with TypeScript
- **Query Builder**: Elegant chainable query API for Prisma models
- **Callback System**: Hooks for before/after operations (create, update, delete, upsert)
- **Column-Level Hooks**: Track changes to specific columns with `afterChange` callbacks
- **Extended Prisma Client**: Enhanced PrismaClient with additional utility methods
- **Type-Safe**: Full IntelliSense and compile-time type checking

## Installation

```bash
npm install prismaroids @prisma/client
```

See [QUICKSTART.md](./QUICKSTART.md) for a complete getting started guide.

## Quick Usage

```typescript
import { db } from 'prismaroids';

// Chainable query builder with full type safety
const posts = await db.query('post')
  .where({ published: true })
  .order({ createdAt: 'desc' })
  .limit(10)
  .include({ author: true })
  .findMany();

// Define callbacks with TypeScript
import { afterCreate, afterChange } from 'prismaroids';

afterCreate('User', async (args, result) => {
  console.log('New user created:', result.email);
});

afterChange('Post', 'published', async (oldValue, newValue, record) => {
  if (!oldValue && newValue) {
    console.log(`Post "${record.title}" was published!`);
  }
});
```

## Documentation

- [Quick Start Guide](./QUICKSTART.md) - Complete setup and usage guide
- [Database CLI Tools](./DATABASE_CLI.md) - Database utility commands
- [Examples](./examples/) - Example code for common patterns

## Database CLI Utilities

Prismaroids includes TypeScript-based database management utilities:

```bash
npm run db:create   # Create database
npm run db:drop     # Drop database
npm run db:migrate  # Run migrations
npm run db:reset    # Reset database
npm run db:seed     # Seed database
```

See [DATABASE_CLI.md](./DATABASE_CLI.md) for detailed documentation.

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
- `pluck(fields)` - Extract specific fields
- `count()`, `sum(field)`, `avg(field)`, `min(field)`, `max(field)` - Aggregations
- `findMany()`, `findFirst()`, `create()`, `update()`, `delete()` - Execute queries

## Callback Hooks

- `beforeCreate(model, callback)` - Before creating a record
- `afterCreate(model, callback)` - After creating a record
- `beforeUpdate(model, callback)` - Before updating a record
- `afterUpdate(model, callback)` - After updating a record
- `beforeDelete(model, callback)` - Before deleting a record
- `afterDelete(model, callback)` - After deleting a record
- `afterUpsert(model, callback)` - After upserting a record
- `afterChange(model, column, callback)` - When a specific column changes

## License

ISC
