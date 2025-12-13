// Main entry point for Prisma Flare
export { ExtendedPrismaClient } from './core/extendedPrismaClient';
export { default as QueryBuilder } from './core/queryBuilder';
export { 
  beforeCreate, 
  afterCreate, 
  beforeUpdate, 
  afterUpdate, 
  beforeDelete, 
  afterDelete, 
  afterChange,
  afterUpsert 
} from './core/hooks';
export { default as hookRegistry } from './core/hookRegistry';
export { registerHooks, loadCallbacks } from './core/hookMiddleware';
export { registry as dbAdapterRegistry } from './core/adapters';
export type { DatabaseAdapter } from './core/adapters';

// Export types
export type {
  ModelName,
  ModelDelegate,
  RecordType,
  FindManyArgs,
  FindFirstArgs,
  CreateArgs,
  UpdateArgs,
  DeleteArgs,
  UpsertArgs,
  HookTiming,
  PrismaOperation,
  BeforeHookCallback,
  AfterHookCallback,
  ColumnChangeCallback,
  AggregateResult
} from './types';
