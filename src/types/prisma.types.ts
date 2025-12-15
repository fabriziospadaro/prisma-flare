import type { PrismaClient } from '@prisma/client';

/**
 * Extract model names from PrismaClient
 */
type RawPrismaClientKeys = Exclude<
  Extract<keyof PrismaClient, string>,
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
>;

/**
 * Extract model names from PrismaClient
 */
export type ModelName = [RawPrismaClientKeys] extends [never]
  ? string
  : RawPrismaClientKeys | Capitalize<RawPrismaClientKeys>;

/**
 * Extract the delegate type for a given model
 */
export type ModelDelegate<T extends ModelName> = Uncapitalize<T> extends keyof PrismaClient
  ? PrismaClient[Uncapitalize<T>]
  : any;

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
export type RecordType<T extends ModelName> = NonNullable<Awaited<
  ReturnType<ModelDelegate<T>['findFirst']>
>>;

/**
 * Extract FindMany args type for a given model
 */
export type FindManyArgs<T extends ModelName> = NonNullable<PrismaArgs<T, 'findMany'>>;

/**
 * Extract FindFirst args type for a given model  
 */
export type FindFirstArgs<T extends ModelName> = NonNullable<PrismaArgs<T, 'findFirst'>>;

/**
 * Helper to make where clause optional
 */
export type OptionalWhere<T> = T extends { where: any } ? Omit<T, 'where'> & { where?: T['where'] } : T;

/**
 * Extract Create args type for a given model
 */
export type CreateArgs<T extends ModelName> = NonNullable<PrismaArgs<T, 'create'>>;

/**
 * Extract Create data type for a given model
 */
export type CreateData<T extends ModelName> = NonNullable<PrismaArgs<T, 'create'>> extends { data: infer D } ? D : never;

/**
 * Extract CreateMany args type for a given model
 */
export type CreateManyArgs<T extends ModelName> = 'createMany' extends keyof ModelDelegate<T>
  ? NonNullable<PrismaArgs<T, 'createMany'>>
  : never;

/**
 * Extract CreateMany data type for a given model
 */
export type CreateManyData<T extends ModelName> = 'createMany' extends keyof ModelDelegate<T>
  ? NonNullable<PrismaArgs<T, 'createMany'>> extends { data: infer D } ? D : never
  : never;

/**
 * Extract Update args type for a given model
 */
export type UpdateArgs<T extends ModelName> = OptionalWhere<NonNullable<PrismaArgs<T, 'update'>>>;

/**
 * Extract Update data type for a given model
 */
export type UpdateData<T extends ModelName> = NonNullable<PrismaArgs<T, 'update'>> extends { data: infer D } ? D : never;

/**
 * Extract UpdateMany args type for a given model
 */
export type UpdateManyArgs<T extends ModelName> = NonNullable<PrismaArgs<T, 'updateMany'>>;

/**
 * Extract UpdateMany data type for a given model
 */
export type UpdateManyData<T extends ModelName> = NonNullable<PrismaArgs<T, 'updateMany'>> extends { data: infer D } ? D : never;


/**
 * Extract Delete args type for a given model
 */
export type DeleteArgs<T extends ModelName> = OptionalWhere<NonNullable<PrismaArgs<T, 'delete'>>>;

/**
 * Extract DeleteMany args type for a given model
 */
export type DeleteManyArgs<T extends ModelName> = NonNullable<PrismaArgs<T, 'deleteMany'>>;

/**
 * Extract Upsert args type for a given model
 */
export type UpsertArgs<T extends ModelName> = OptionalWhere<NonNullable<PrismaArgs<T, 'upsert'>>>;

/**
 * Extract Where input type
 */
export type WhereInput<T extends ModelName> = FindManyArgs<T> extends { where?: infer W } ? W : never;

/**
 * Extract OrderBy input type
 */
export type OrderByInput<T extends ModelName> = FindManyArgs<T> extends { orderBy?: infer O } ? O : never;

/**
 * Extract Select input type
 */
export type SelectInput<T extends ModelName> = FindManyArgs<T> extends { select?: infer S } ? S : never;

/**
 * Extract Include input type
 */
export type IncludeInput<T extends ModelName> =
  FindManyArgs<T> extends { include?: infer I } ? I : never;


export type IncludeMap<T extends ModelName> = string extends T ? any : NonNullable<IncludeInput<T>>;

export type IncludeKey<T extends ModelName> = string extends T ? string : (keyof IncludeMap<T> & string);

export type IncludeValue<T extends ModelName, K extends IncludeKey<T>> =
  string extends T ? any : (K extends keyof IncludeMap<T> ? IncludeMap<T>[K] : never);

/**
 * Extract Distinct input type
 */
export type DistinctInput<T extends ModelName> = FindManyArgs<T> extends { distinct?: infer D } ? D : never;

/**
 * Extract GroupBy args type
 */
export type GroupByArgs<T extends ModelName> = NonNullable<PrismaArgs<T, 'groupBy'>>;

/**
 * Extract GroupBy input type
 */
export type GroupByInput<T extends ModelName> = GroupByArgs<T> extends { by: infer B } ? B : never;

/**
 * Extract Having input type
 */
export type HavingInput<T extends ModelName> = GroupByArgs<T> extends { having?: infer H } ? H : never;

/**
 * Extract Aggregate args type
 */
export type AggregateArgs<T extends ModelName> = NonNullable<PrismaArgs<T, 'aggregate'>>;

export type SumFields<T extends ModelName> = AggregateArgs<T> extends { _sum?: infer S } ? keyof S : string;
export type AvgFields<T extends ModelName> = AggregateArgs<T> extends { _avg?: infer A } ? keyof A : string;
export type MinFields<T extends ModelName> = AggregateArgs<T> extends { _min?: infer M } ? keyof M : string;
export type MaxFields<T extends ModelName> = AggregateArgs<T> extends { _max?: infer M } ? keyof M : string;

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

/**
 * Generic query arguments
 */
export type QueryArgs = Record<string, any>;

/**
 * Paginated result interface
 */
export interface PaginatedResult<T> {
  data: T[];
  meta: {
    total: number;
    lastPage: number;
    currentPage: number;
    perPage: number;
    prev: number | null;
    next: number | null;
  };
}

export type PrismaAction =
  | 'findUnique'
  | 'findUniqueOrThrow'
  | 'findMany'
  | 'findFirst'
  | 'findFirstOrThrow'
  | 'create'
  | 'createMany'
  | 'update'
  | 'updateMany'
  | 'upsert'
  | 'delete'
  | 'deleteMany'
  | 'groupBy'
  | 'count'
  | 'aggregate'
  | 'findRaw'
  | 'aggregateRaw'
  | 'executeRaw'
  | 'queryRaw'
  | 'runCommandRaw';

export type PrismaMiddlewareParams = {
  model?: string;
  action: PrismaAction;
  args: any;
  dataPath: string[];
  runInTransaction: boolean;
};

