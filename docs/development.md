# Development & Testing

## Project Structure

prisma-flare uses a **shared test suite** architecture that runs the same tests against multiple Prisma configurations:

```
tests/
├── suite/                 # Shared test suite (all test files live here)
│   ├── integration/       # Integration tests
│   │   ├── aggregations.test.ts
│   │   ├── crud.test.ts
│   │   ├── custom-models.test.ts
│   │   ├── edge-cases.test.ts
│   │   ├── hooks.test.ts
│   │   ├── model-registry.test.ts
│   │   ├── queries.test.ts
│   │   ├── relations.test.ts
│   │   └── transactions.test.ts
│   ├── helpers/           # Shared utilities
│   │   ├── base.ts        # Assertions, unique ID generation
│   │   └── factories.ts   # Test data factories
│   └── types/             # Type-only tests
├── default-client/        # Config: prisma-client-js, default output
├── custom-output/         # Config: prisma-client-js, custom output path
├── new-provider/          # Config: prisma-client (Prisma 7+)
└── vitest.config.ts       # Root config for running all projects
```

## Test Matrix Architecture

Each configuration project contains:
- **`adapter.ts`** - Exports `DB`, helpers, and factories bound to the project's Prisma client
- **`vitest.config.ts`** - Configures path aliases to resolve `#test-helpers` to the adapter
- **`prisma/`** - Schema and generated Prisma client for that configuration

| Test Project | Generator Provider | Output Path | Prisma Client Import |
|--------------|-------------------|-------------|---------------------|
| `default-client` | `prisma-client-js` | Default (`@prisma/client`) | `@prisma/client` |
| `custom-output` | `prisma-client-js` | `./prisma/generated/client` | `./prisma/generated/client` |
| `new-provider` | `prisma-client` | `./prisma/generated` | `./prisma/generated/client` |

### How the Adapter Pattern Works

Tests import from two sources:
1. **`prisma-flare/generated`** - FlareBuilder API (`DB.users`, `DB.posts`, etc.)
2. **`#test-helpers`** - Database operations and utilities

The `#test-helpers` alias resolves to each project's `adapter.ts`, which provides:

```typescript
// tests/default-client/adapter.ts
export { DB } from 'prisma-flare/generated';
export { resetCounter, uniqueEmail, assertRecordCreated } from '../suite/helpers/base.js';
export { createFactories } from '../suite/helpers/factories.js';

// Project-specific Prisma client for raw operations
const prisma = new PrismaClient();
export async function cleanDatabase() { /* ... */ }
export async function disconnect() { /* ... */ }
```

Tests then use these consistently:

```typescript
// tests/suite/integration/crud.test.ts
import { DB } from 'prisma-flare/generated';
import { cleanDatabase, disconnect, uniqueEmail } from '#test-helpers';

describe('CRUD', () => {
  beforeEach(async () => {
    await cleanDatabase();
  });

  afterAll(async () => {
    await disconnect();
  });

  it('creates a user', async () => {
    const user = await DB.users.create({ email: uniqueEmail() });
    expect(user.id).toBeDefined();
  });
});
```

This allows the **same test file** to run against different Prisma configurations without modification.

## Running Tests

```bash
# Run all tests (setup + run all configurations)
npm test

# Run test suite only (skip setup, for re-runs)
npm run test:suite

# Watch mode (default-client)
npm run test:watch

# Run a specific configuration manually
cd tests/default-client && npx vitest run
cd tests/custom-output && npx vitest run
cd tests/new-provider && npx vitest run

# Type check everything (source + all test projects)
npm run check

# Lint and format
npm run lint
```

## Test Categories

**Integration Tests** (`tests/suite/integration/`):
- **`crud.test.ts`** - Create, Read, Update, Delete operations
- **`queries.test.ts`** - `where()`, `order()`, `limit()`, `include()`, pagination
- **`aggregations.test.ts`** - `count()`, `aggregate()`, `groupBy()`, `having()`
- **`hooks.test.ts`** - `beforeCreate`, `afterUpdate`, `afterChange` callbacks
- **`transactions.test.ts`** - Transaction support with FlareBuilder
- **`relations.test.ts`** - Nested includes and relation queries
- **`custom-models.test.ts`** - Custom model class extensions
- **`model-registry.test.ts`** - Model registration and `DB.from()` API
- **`edge-cases.test.ts`** - Error handling, edge cases, type inference

**Shared Helpers** (`tests/suite/helpers/`):
- **`base.ts`** - `uniqueEmail()`, assertion helpers, counter reset
- **`factories.ts`** - `createUser()`, `createUserWithPosts()` factories

## Adding a New Test Configuration

To test a new Prisma configuration:

```bash
# 1. Create directory structure
mkdir -p tests/my-config/prisma

# 2. Initialize package
cd tests/my-config
npm init -y
npm install @prisma/client vitest typescript

# 3. Link local prisma-flare
npm link prisma-flare  # or npm install ../../prisma-flare-*.tgz

# 4. Create schema.prisma with your configuration
# (Use the same User/Post models as other test projects)

# 5. Generate clients
npx prisma generate
npx prisma-flare generate

# 6. Create adapter.ts
cat > adapter.ts << 'EOF'
import { DB } from 'prisma-flare/generated';
import { PrismaClient } from '@prisma/client';

export { resetCounter, uniqueEmail, assertRecordCreated, assertArrayLength, assertSameRecord } from '../suite/helpers/base.js';
export { createFactories } from '../suite/helpers/factories.js';
export { DB };

const prisma = new PrismaClient();
export function getPrismaClient() { return prisma; }
export async function cleanDatabase() {
  await prisma.post.deleteMany();
  await prisma.user.deleteMany();
}
export async function disconnect() {
  await prisma.$disconnect();
}

import { createFactories } from '../suite/helpers/factories.js';
const { createUser, createUserWithPosts } = createFactories(DB as any);
export { createUser, createUserWithPosts };
EOF

# 7. Create vitest.config.ts
cat > vitest.config.ts << 'EOF'
import { defineConfig } from 'vitest/config';
import * as path from 'path';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['../suite/**/*.test.ts'],
    testTimeout: 30000,
    fileParallelism: false,
  },
  resolve: {
    alias: [{
      find: '#test-helpers',
      replacement: path.resolve(__dirname, 'adapter.ts')
    }]
  },
});
EOF

# 8. Run tests
npx vitest run
```

## Building & Publishing

```bash
# Build the package
npm run build

# Create a tarball for testing
npm pack

# Install tarball in test project
cd tests/my-test
npm install ../../prisma-flare-*.tgz
```

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Ensure all tests pass (`npm test`)
5. Submit a pull request

### Code Style

- TypeScript strict mode
- No `as any` casts (strong typing is core to this library)
- Prefer explicit types over inference for public APIs

## Code Generation Templates

prisma-flare generates type-safe client wrappers using a modular template system located in `src/cli/templates/`.

### Template Architecture

```
src/cli/templates/
├── index.ts                    # Barrel exports
├── type-helpers.ts             # Type helper definitions (ModelName, WhereInput, etc.)
├── flare-builder-interface.ts  # FlareBuilder interface/class generation
└── flare-client-interface.ts   # FlareClient interface generation
```

### Adding New FlareBuilder Methods

When adding a new method to `FlareBuilder` (`src/core/flareBuilder.ts`), you must also add it to the template system so generated types include it:

1. **Add the method to `flareBuilder.ts`** - Implement the actual method
2. **Add the method signature to `FLARE_BUILDER_METHODS`** in `src/cli/templates/flare-builder-interface.ts`:

```typescript
// src/cli/templates/flare-builder-interface.ts
export const FLARE_BUILDER_METHODS = {
  // ... existing categories ...
  utilities: [
    // ... existing methods ...
    {
      name: 'myNewMethod',
      signature: '(arg: string): FlareBuilder<T, Args>',
    },
  ],
};
```

3. **Rebuild** - Run `npm run build` to regenerate

The template system will automatically include your new method in:
- Generated `flare.ts` for new provider projects
- Generated `prisma-flare-generated/index.d.ts` for custom output projects

### Template Options

Each template generator accepts options for customization:

**`generateTypeHelpers(options)`**
```typescript
{
  prismaClientName?: string;  // Default: 'PrismaClient'
  prismaNamespace?: string;   // Default: 'Prisma'
  exportTypes?: boolean;      // Default: true
}
```

**`generateFlareBuilderInterface(options)`**
```typescript
{
  asInterface?: boolean;           // true = interface, false = declare class
  name?: string;                   // Default: 'FlareBuilder'
  shouldExport?: boolean;          // Default: true
  generics?: string;               // Type parameters
  constructorSignature?: string;   // Constructor signature (for declare class)
}
```

**`generateFlareClientInterface(options)`**
```typescript
{
  asInterface?: boolean;       // true = interface, false = declare class
  basePrismaClient?: string;   // Default: 'BasePrismaClient'
  shouldExport?: boolean;      // Default: true
}
```

### Why Templates?

The generated code needs to use the **user's Prisma types**, not prisma-flare's bundled types. This is because:

1. Custom output paths have different import locations
2. The new `prisma-client` provider generates TypeScript
3. Type inference must work with the user's actual schema

By generating type definitions locally, TypeScript resolves types against the user's Prisma client, providing accurate autocomplete and type checking
