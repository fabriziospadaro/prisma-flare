# Development & Testing

## Project Structure

prisma-flare includes three test projects that verify compatibility across different Prisma configurations:

```
tests/
├── default-client/    # Standard @prisma/client setup (prisma-client-js)
├── custom-output/     # prisma-client-js with custom output path
└── new-provider/      # prisma-client (Prisma 7+ TypeScript-first)
```

## Test Matrix

| Test Project | Generator Provider | Output Path | Prisma Client Import |
|--------------|-------------------|-------------|---------------------|
| `default-client` | `prisma-client-js` | Default (`@prisma/client`) | `@prisma/client` |
| `custom-output` | `prisma-client-js` | `./prisma/generated/client` | `./prisma/generated/client` |
| `new-provider` | `prisma-client` | `./prisma/generated` | `./prisma/generated/client` |

Each test project verifies:
- **FlareBuilder API**: `where()`, `order()`, `limit()`, `include()`, etc.
- **Type Safety**: Full IntelliSense, no `as any` casts needed
- **Hooks System**: `beforeCreate`, `afterUpdate`, `afterChange`, etc.
- **Transactions**: `db.transaction()` with FlareBuilder inside

## Running Tests

```bash
# Run all tests from project root
npm test

# Run tests for a specific configuration
cd tests/default-client && npm test
cd tests/custom-output && npm test
cd tests/new-provider && npm test

# Type check without running tests
cd tests/custom-output && npx tsc --noEmit
```

## Test Coverage

Tests are organized by category:

**Integration tests** (`tests/integration/`):
- **`hooks.test.ts`**: Tests callback system (`beforeCreate`, `afterUpdate`, `afterChange`)
- **`transactions.test.ts`**: Tests transaction support with FlareBuilder
- **`flare-builder.test.ts`**: Tests FlareBuilder query chaining
- **`flare-client.test.ts`**: Tests FlareClient API and `DB.model` static access

**Unit tests** (`tests/unit/` - in default-client):
- **`flareBuilder.unit.test.ts`**: Unit tests for FlareBuilder methods
- **`adapters.unit.test.ts`**: Unit tests for database adapters

**CRUD tests** (`tests/integration/crud/` - in default-client):
- **`create.test.ts`**, **`read.test.ts`**, **`update.test.ts`**, **`delete.test.ts`**, **`upsert.test.ts`**

## Setting Up a Test Project

If you need to test a new configuration:

```bash
# 1. Create directory
mkdir tests/my-test && cd tests/my-test

# 2. Initialize
npm init -y
npm install prisma @prisma/client vitest typescript

# 3. Link local prisma-flare
npm install ../../prisma-flare-*.tgz  # or use npm link

# 4. Create schema.prisma with your configuration

# 5. Generate Prisma client
npx prisma generate

# 6. Generate prisma-flare
npx prisma-flare generate

# 7. Run tests
npm test
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
