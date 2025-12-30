/**
 * Generates type helper definitions for extracting types from the user's Prisma client.
 * These types mirror the definitions in src/types/prisma.types.ts but use the local
 * PrismaClient/Prisma imports instead of @prisma/client.
 */

export interface TypeHelpersOptions {
  /** The name of the PrismaClient type to use (e.g., 'PrismaClient' or 'BasePrismaClient') */
  prismaClientName?: string;
  /** The name of the Prisma namespace to use (e.g., 'Prisma' or 'BasePrisma') */
  prismaNamespace?: string;
  /** Whether to export the types (true) or keep them local (false) */
  exportTypes?: boolean;
}

/**
 * Generates type helper definitions that extract types from the user's Prisma client.
 */
export function generateTypeHelpers(options: TypeHelpersOptions = {}): string {
  const {
    prismaClientName = 'PrismaClient',
    // prismaNamespace is available for future use but types are extracted from PrismaClient directly
    prismaNamespace: _prismaNamespace = 'Prisma',
    exportTypes = true,
  } = options;
  void _prismaNamespace; // Suppress unused warning - kept for API compatibility

  const exportKeyword = exportTypes ? 'export ' : '';

  return `
// ============================================================================
// Type Helpers - Using YOUR Prisma client types
// ============================================================================

/**
 * Extract model names from PrismaClient (lowercase delegate names only).
 * Use lowercase model names like 'game', 'user', 'gameDetail' - NOT PascalCase.
 */
type RawPrismaClientKeys = Exclude<
  Extract<keyof ${prismaClientName}, string>,
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

/** Model names from your Prisma schema (lowercase only, e.g., 'game', 'user') */
${exportKeyword}type ModelName = RawPrismaClientKeys;

/** Get the delegate type for a model */
${exportKeyword}type ModelDelegate<T extends ModelName> = Uncapitalize<T> extends keyof ${prismaClientName}
  ? ${prismaClientName}[Uncapitalize<T>]
  : never;

/** Get the record type for a model */
${exportKeyword}type RecordType<T extends ModelName> = NonNullable<Awaited<ReturnType<ModelDelegate<T>['findFirst']>>>;

/** Get Prisma args type for a model operation */
type PrismaArgs<T extends ModelName, A extends keyof ModelDelegate<T>> =
  ModelDelegate<T>[A] extends (args: infer Args) => any ? Args :
  ModelDelegate<T>[A] extends (args?: infer Args) => any ? Args : never;

/** FindMany args type */
type FindManyArgs<T extends ModelName> = NonNullable<PrismaArgs<T, 'findMany'>>;

/** Where input type (for findMany, etc.) */
type WhereInput<T extends ModelName> = FindManyArgs<T> extends { where?: infer W } ? W : never;

/** OrderBy input type */
type OrderByInput<T extends ModelName> = FindManyArgs<T> extends { orderBy?: infer O } ? O : never;

/** Select input type */
type SelectInput<T extends ModelName> = FindManyArgs<T> extends { select?: infer S } ? S : never;

/** Include input type */
type IncludeInput<T extends ModelName> = FindManyArgs<T> extends { include?: infer I } ? I : never;

/** Distinct input type */
type DistinctInput<T extends ModelName> = FindManyArgs<T> extends { distinct?: infer D } ? D : never;

/** Create data type */
type CreateData<T extends ModelName> = NonNullable<PrismaArgs<T, 'create'>> extends { data: infer D } ? D : never;

/** CreateMany data type */
type CreateManyData<T extends ModelName> = 'createMany' extends keyof ModelDelegate<T>
  ? NonNullable<PrismaArgs<T, 'createMany'>> extends { data: infer D } ? D : never
  : never;

/** Update data type */
type UpdateData<T extends ModelName> = NonNullable<PrismaArgs<T, 'update'>> extends { data: infer D } ? D : never;

/** Helper to make where clause optional */
type OptionalWhere<T> = T extends { where: any } ? Omit<T, 'where'> & { where?: T['where'] } : T;

/** Upsert args type (with optional where, includes compound unique constraints) */
type UpsertArgs<T extends ModelName> = OptionalWhere<NonNullable<PrismaArgs<T, 'upsert'>>>;

/** Delete args type (with optional where, includes compound unique constraints) */
type DeleteArgs<T extends ModelName> = OptionalWhere<NonNullable<PrismaArgs<T, 'delete'>>>;

/** DeleteMany args type */
type DeleteManyArgs<T extends ModelName> = NonNullable<PrismaArgs<T, 'deleteMany'>>;

/** GroupBy args type */
type GroupByArgs<T extends ModelName> = NonNullable<PrismaArgs<T, 'groupBy'>>;

/** GroupBy input type */
type GroupByInput<T extends ModelName> = GroupByArgs<T> extends { by: infer B } ? B : never;

/** Having input type */
type HavingInput<T extends ModelName> = GroupByArgs<T> extends { having?: infer H } ? H : never;

/** Aggregate args type */
type AggregateArgs<T extends ModelName> = NonNullable<PrismaArgs<T, 'aggregate'>>;

type SumFields<T extends ModelName> = AggregateArgs<T> extends { _sum?: infer S } ? keyof S : string;
type AvgFields<T extends ModelName> = AggregateArgs<T> extends { _avg?: infer A } ? keyof A : string;
type MinFields<T extends ModelName> = AggregateArgs<T> extends { _min?: infer M } ? keyof M : string;
type MaxFields<T extends ModelName> = AggregateArgs<T> extends { _max?: infer M } ? keyof M : string;

type IncludeMap<T extends ModelName> = NonNullable<IncludeInput<T>>;
type IncludeKey<T extends ModelName> = keyof IncludeMap<T> & string;
`.trimStart();
}
