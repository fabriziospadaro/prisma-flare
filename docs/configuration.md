# Configuration

## prisma-flare.config.json

Create a `prisma-flare.config.json` in your project root to customize paths:

```json
{
  "modelsPath": "src/models",
  "dbPath": "src/lib/db",
  "callbacksPath": "src/callbacks"
}
```

### Options

| Option | Default | Description |
|--------|---------|-------------|
| `modelsPath` | `prisma/models` | Where to generate query classes |
| `dbPath` | `prisma/db` | Path to file exporting your `db` instance |
| `callbacksPath` | `prisma/callbacks` | Directory containing callback/hook files |
| `plurals` | `{}` | Custom pluralization for model names |
| `prismaClientPath` | (auto-detected) | Override auto-detected Prisma client import path |

### Custom Plurals

Override automatic pluralization for model names:

```json
{
  "plurals": {
    "Person": "people",
    "Equipment": "equipment",
    "Child": "children"
  }
}
```

### Custom Prisma Client Path

Override auto-detected Prisma client import path (useful for monorepos or non-standard setups):

```json
{
  "prismaClientPath": "./generated/client"
}
```

Or for monorepo packages:

```json
{
  "prismaClientPath": "@myorg/database"
}
```

---

## Prisma Client Configuration

### Default Location (`@prisma/client`)

```typescript
// prisma/db.ts
import './callbacks';
import { PrismaClient, Prisma } from '@prisma/client';
import { createFlareClient } from 'prisma-flare';

const FlareClient = createFlareClient(PrismaClient, Prisma);
export const db = new FlareClient();
```

### Custom Output Path (`prisma-client-js`)

```prisma
// schema.prisma
generator client {
  provider = "prisma-client-js"
  output   = "./generated/client"
}
```

```typescript
// prisma/db.ts
import './callbacks';
import { PrismaClient, Prisma } from './generated/client';
import { createFlareClient } from 'prisma-flare';

const FlareClient = createFlareClient(PrismaClient, Prisma);
export const db = new FlareClient();
```

### New Provider (`prisma-client` - Prisma 7+)

The new TypeScript-first generator requires a driver adapter:

```prisma
// schema.prisma
datasource db {
  provider = "sqlite"
}

generator client {
  provider = "prisma-client"
  output   = "./generated/client"
}
```

```typescript
// prisma/db.ts
import './callbacks';
import { PrismaClient, Prisma } from './generated/client/client';
import { PrismaLibSQL } from '@prisma/adapter-libsql';
import { createFlareClient } from 'prisma-flare';

const adapter = new PrismaLibSQL({ url: 'file:./prisma/dev.db' });
const FlareClient = createFlareClient(PrismaClient, Prisma);
export const db = new FlareClient({ adapter });
```

---

## FlareClient Options

### Disable Callbacks Middleware

```typescript
const FlareClient = createFlareClient(PrismaClient, Prisma);
export const db = new FlareClient({ callbacks: false });
```

### With Database Adapter

```typescript
import { PrismaPg } from '@prisma/adapter-pg';

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const FlareClient = createFlareClient(PrismaClient, Prisma);
export const db = new FlareClient({ adapter });
```

---

## CLI Commands

```bash
npx prisma-flare generate   # Generate query classes and callbacks index
npx prisma-flare create     # Create database
npx prisma-flare drop       # Drop database
npx prisma-flare migrate    # Run migrations
npx prisma-flare reset      # Reset database
npx prisma-flare seed       # Seed database
```

### Custom Database Adapters

Add support for other databases:

```typescript
import { dbAdapterRegistry, DatabaseAdapter } from 'prisma-flare';

const myAdapter: DatabaseAdapter = {
  name: 'my-db',
  matches: (url) => url.startsWith('mydb://'),
  create: async (url) => { /* create logic */ },
  drop: async (url) => { /* drop logic */ }
};

dbAdapterRegistry.register(myAdapter);
```
