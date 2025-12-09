import type { PrismaClient } from '@prisma/client';

/**
 * Extract model names from PrismaClient
 */
export type ModelName = Exclude<
  keyof PrismaClient,
  | '$connect'
  | '$disconnect'
  | '$on'
  | '$transaction'
  | '$use'
  | '$extends'
  | '$executeRaw'
  | '$executeRawUnsafe'
  | '$queryRaw'
  | '$queryRawUnsafe'
  | symbol
>;

/**
 * Extract the delegate type for a given model
 */
export type ModelDelegate<T extends ModelName> = PrismaClient[T];

/**
 * Get the proper Prisma args type for a model operation
 */
export type PrismaArgs<
  T extends ModelName,
  A extends keyof ModelDelegate<T>
> = ModelDelegate<T>[A] extends (args: infer Args) => any 
  ? Args
  : ModelDelegate<T>[A] extends (args?: infer Args) => any 
    ? Args
    : never;

/**
 * Extract the record type for a given model
 */
export type RecordType<T extends ModelName> = Awaited<
  ReturnType<ModelDelegate<T>['findFirst']>
>;

/**
 * Extract FindMany args type for a given model
 */
export type FindManyArgs<T extends ModelName> = NonNullable<PrismaArgs<T, 'findMany'>>;

/**
 * Extract FindFirst args type for a given model  
 */
export type FindFirstArgs<T extends ModelName> = NonNullable<PrismaArgs<T, 'findFirst'>>;

/**
 * Extract Create args type for a given model
 */
export type CreateArgs<T extends ModelName> = NonNullable<PrismaArgs<T, 'create'>>;

/**
 * Extract Update args type for a given model
 */
export type UpdateArgs<T extends ModelName> = NonNullable<PrismaArgs<T, 'update'>>;

/**
 * Extract Delete args type for a given model
 */
export type DeleteArgs<T extends ModelName> = NonNullable<PrismaArgs<T, 'delete'>>;

/**
 * Extract Upsert args type for a given model
 */
export type UpsertArgs<T extends ModelName> = NonNullable<PrismaArgs<T, 'upsert'>>;

/**
 * Hook timing - before or after operation
 */
export type HookTiming = 'before' | 'after';

/**
 * Prisma operation types
 */
export type PrismaOperation =
  | 'create'
  | 'update'
  | 'updateMany'
  | 'delete'
  | 'deleteMany'
  | 'upsert'
  | 'findFirst'
  | 'findMany'
  | 'findUnique';

/**
 * Callback function for before hooks
 */
export type BeforeHookCallback<_T extends ModelName = ModelName> = (
  args: any,
  prisma: PrismaClient
) => Promise<void> | void;

/**
 * Callback function for after hooks
 */
export type AfterHookCallback<_T extends ModelName = ModelName> = (
  args: any,
  result: any,
  prisma: PrismaClient
) => Promise<void> | void;

/**
 * Callback function for column change hooks
 */
export type ColumnChangeCallback<T extends ModelName = ModelName> = (
  oldValue: any,
  newValue: any,
  record: NonNullable<RecordType<T>>,
  prisma: PrismaClient
) => Promise<void> | void;

/**
 * Query builder aggregation result types
 */
export interface AggregateResult {
  _sum: Record<string, number | null>;
  _avg: Record<string, number | null>;
  _min: Record<string, any>;
  _max: Record<string, any>;
  _count: Record<string, number>;
}
