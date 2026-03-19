// Main entry point for Prisma Flare
export { createFlareClient } from './core/createFlareClient';
export type {
  PrismaNamespace,
  PrismaClientLike,
  FlareClientClass,
  FlareClientInstance,
  FactoryFlareClientOptions,
  // Export as FlareClientOptions for generated code compatibility
  FactoryFlareClientOptions as FlareClientOptions
} from './core/createFlareClient';
export { default as FlareBuilder } from './core/flareBuilder';
export type { RelationModelMap } from './core/flareBuilder';
export { modelRegistry } from './core/modelRegistry';
// Hooks are NOT exported from prisma-flare main entry point.
// Users should import hooks from 'prisma-flare-generated' for proper types.
// Internal code uses 'prisma-flare/hooks' for the runtime implementation.
export type { HookConfig } from './core/hookRegistry';
export { registerHooks, registerHooksLegacy, createHooksExtension, loadCallbacks, setPrismaNamespace } from './core/hookMiddleware';
export type { PrismaNamespaceLike } from './core/hookMiddleware';
export { registry as dbAdapterRegistry } from './core/adapters';
export type { DatabaseAdapter } from './core/adapters';

// Export types
export type {
  ModelName,
  ModelDelegate,
  RecordType,
  FieldName,
  FindManyArgs,
  FindFirstArgs,
  CreateArgs,
  CreateData,
  CreateManyArgs,
  CreateManyData,
  UpdateArgs,
  DeleteArgs,
  UpsertArgs,
  HookTiming,
  PrismaOperation,
  BeforeHookCallback,
  AfterHookCallback,
  ColumnChangeCallback,
  ColumnChangeOptions,
  HookOptions,
  AggregateResult,
  PaginatedResult
} from './types';
