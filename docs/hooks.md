# Hooks & Callbacks

prisma-flare provides a powerful callback system for running logic before or after database operations.

## Setup

Create callback files in your callbacks directory (default: `prisma/callbacks`), then run `npx prisma-flare generate` to update the index.

```typescript
// prisma/db.ts
import './callbacks';  // Import generated index to register all hooks
import { PrismaClient, Prisma } from '@prisma/client';
import { createFlareClient } from 'prisma-flare';

const FlareClient = createFlareClient(PrismaClient, Prisma);
export const db = new FlareClient();
```

## Basic Hooks

### `beforeCreate` / `afterCreate`

```typescript
// prisma/callbacks/user.ts
import { beforeCreate, afterCreate } from 'prisma-flare';

// Validation before creating
beforeCreate('user', async (args) => {
  if (!args.data.email.includes('@')) {
    throw new Error('Invalid email address');
  }
});

// Run after a user is created
afterCreate('user', async (args, result) => {
  console.log('New user created:', result.email);
  await sendWelcomeEmail(result.email);
});
```

### `beforeUpdate` / `afterUpdate`

```typescript
import { beforeUpdate, afterUpdate } from 'prisma-flare';

beforeUpdate('user', async (args) => {
  // Add updatedAt timestamp
  args.data.updatedAt = new Date();
});

afterUpdate('user', async (args, result) => {
  console.log('User updated:', result.id);
});
```

### `beforeDelete` / `afterDelete`

```typescript
import { beforeDelete, afterDelete } from 'prisma-flare';

beforeDelete('post', async (args) => {
  // Archive before deleting
  await archivePost(args.where.id);
});

afterDelete('post', async (args, result) => {
  console.log('Post deleted:', result.id);
});
```

### `afterUpsert`

```typescript
import { afterUpsert } from 'prisma-flare';

afterUpsert('user', async (args, result) => {
  console.log('User upserted:', result.email);
});
```

## Column-Level Hooks

Track changes to specific columns with `afterChange`:

```typescript
// prisma/callbacks/post.ts
import { afterChange } from 'prisma-flare';

// Run when the 'published' field changes
afterChange('post', 'published', async (oldValue, newValue, record) => {
  if (!oldValue && newValue) {
    console.log(`Post "${record.title}" was published!`);
    await notifySubscribers(record);
  }
});

// Track status transitions
afterChange('order', 'status', async (oldValue, newValue, record) => {
  if (oldValue === 'pending' && newValue === 'shipped') {
    await sendShippingNotification(record);
  }
});
```

### Smart Value Comparison

Column hooks use intelligent comparison to detect real changes:

| Type | Comparison Method |
|------|-------------------|
| `Date` | Compares by `.getTime()` (milliseconds) |
| `Decimal` (Prisma) | Compares by `.toString()` |
| `null` / `undefined` | Strict equality |
| Objects/JSON | Deep comparison via `JSON.stringify` |
| Primitives | Strict equality (`===`) |

## Hook Configuration

Configure hook behavior globally:

```typescript
import { hookRegistry } from 'prisma-flare';

// Disable column hooks globally (for performance-critical paths)
hookRegistry.configure({ enableColumnHooks: false });

// Limit re-fetching on large updateMany operations
hookRegistry.configure({ maxRefetch: 1000 });

// Disable the warning when hooks are skipped
hookRegistry.configure({ warnOnSkip: false });

// Check current configuration
const config = hookRegistry.getConfig();
```

### Configuration Options

| Option | Default | Description |
|--------|---------|-------------|
| `enableColumnHooks` | `true` | Enable/disable all column-level hooks |
| `maxRefetch` | `1000` | Max records to re-fetch for column hooks. Prevents expensive operations on large `updateMany`. Set to `Infinity` to disable limit. |
| `warnOnSkip` | `true` | Log warning when hooks are skipped due to limits |

## Per-Call Hook Skip

Skip column hooks on a per-call basis:

```typescript
// Skip column hooks for this specific update only
await DB.users.withId(userId).update({
  status: 'active',
  __flare: { skipColumnHooks: true }
} as any);

// Regular hooks (beforeUpdate, afterUpdate) still fire
// Only column-level hooks (afterChange) are skipped
```

Useful for:
- Batch migrations where you don't want to trigger side effects
- Performance-critical paths
- Avoiding recursive hook triggers

## Advanced Hook Registration

For advanced use cases:

```typescript
import {
  setPrismaNamespace,      // Set Prisma namespace for hooks
  registerHooksLegacy,     // Force legacy $use API (Prisma ≤6 only)
  createHooksExtension,    // Get raw extension for manual use
  loadCallbacks            // Manually load callbacks at runtime
} from 'prisma-flare';

// Manual extension on raw PrismaClient (advanced)
import { PrismaClient, Prisma } from '@prisma/client';

setPrismaNamespace(Prisma);
const prisma = new PrismaClient().$extends(createHooksExtension(new PrismaClient()));
```

For most use cases, just use `createFlareClient(PrismaClient, Prisma)` which handles everything automatically.
