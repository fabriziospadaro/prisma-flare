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
  /** The generated RelationModelMap type definition string */
  relationModelMap?: string;
}

/**
 * Generates type helper definitions that extract types from the user's Prisma client.
 */
export function generateTypeHelpers(options: TypeHelpersOptions = {}): string {
  const {
    prismaClientName = 'PrismaClient',
    prismaNamespace = 'Prisma',
    exportTypes = true,
    relationModelMap = '// RelationModelMap not generated\ntype RelationModelMap = Record<string, Record<string, string>>;',
  } = options;

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

/**
 * Helper to extract a single relation type by using Prisma.Result with a concrete include.
 * We use a type-level helper that computes the result type with a specific include key.
 */
type SingleIncludeResult<T extends ModelName, K extends IncludeKey<T>> =
  ${prismaNamespace}.Result<ModelDelegate<T>, { include: { [P in K]: true } }, 'findFirst'>;

/**
 * Extract the relation type for a given model and relation key.
 * Uses Prisma.Result with a synthetic include to get the correct relation type.
 * This works around the issue where RecordType<T> doesn't include relation fields
 * in the new prisma-client provider.
 */
type RelationType<T extends ModelName, K extends string> =
  K extends IncludeKey<T>
    ? K extends keyof NonNullable<SingleIncludeResult<T, K>>
      ? NonNullable<SingleIncludeResult<T, K>>[K]
      : never
    : never;

/**
 * Compute the relation type with optional nested includes.
 * If NestedArgs has an include clause, we merge the base relation type
 * with the included relations from that nested include.
 */
type RelationTypeWithNested<T extends ModelName, K extends string, NestedArgs = true> =
  K extends IncludeKey<T>
    ? K extends keyof NonNullable<SingleIncludeResult<T, K>>
      ? NestedArgs extends { include: infer NestedInc }
        ? RelationModelName<T, K> extends ModelName
          ? NonNullable<SingleIncludeResult<T, K>>[K] extends (infer E)[]
            ? (E & IncludedRelations<RelationModelName<T, K>, NestedInc>)[]
            : NonNullable<SingleIncludeResult<T, K>>[K] & IncludedRelations<RelationModelName<T, K>, NestedInc>
          : NonNullable<SingleIncludeResult<T, K>>[K]
        : NonNullable<SingleIncludeResult<T, K>>[K]
      : never
    : never;

/**
 * Compute included relations type from Args['include'].
 * For each key in include that is truthy, add the corresponding relation type.
 * Supports nested includes by passing the full include value to RelationTypeWithNested.
 */
type IncludedRelations<T extends ModelName, Inc> = Inc extends Record<string, any>
  ? { [K in keyof Inc as Inc[K] extends false | undefined | null ? never : K]: RelationTypeWithNested<T, K & string, Inc[K]> }
  : {};

${relationModelMap}

/**
 * Get the model name for a relation on model T with key K.
 * Uses the generated RelationModelMap for reliable model name lookup.
 * Returns never for unknown keys (non-relations like _count), which disables
 * callback typing for those keys without hardcoding specific names.
 */
type RelationModelName<T extends ModelName, K extends IncludeKey<T>> =
  T extends keyof RelationModelMap
    ? K extends keyof RelationModelMap[T]
      ? RelationModelMap[T][K] extends ModelName
        ? RelationModelMap[T][K]
        : never
      : never
    : never;

/**
 * FlareResult - Custom result type that properly merges base entity with included relations.
 * This fixes the issue where Prisma.Result doesn't work correctly with generic types
 * in the new prisma-client provider.
 *
 * @typeParam T - The model name
 * @typeParam Args - The query args (may contain include, select, etc.)
 * @typeParam _Op - The operation type (findFirst, findMany, etc.) - used for nullability
 */
type FlareResult<T extends ModelName, Args, _Op extends string> =
  Args extends { include: infer Inc }
    ? RecordType<T> & IncludedRelations<T, Inc>
    : RecordType<T>;

/**
 * FlareResultMany - Result type for findMany operations (always returns array)
 */
type FlareResultMany<T extends ModelName, Args> = FlareResult<T, Args, 'findMany'>[];

/**
 * FlareResultNullable - Result type for operations that may return null (findFirst, findUnique)
 */
type FlareResultNullable<T extends ModelName, Args> = FlareResult<T, Args, 'findFirst'> | null;

/**
 * FlareResultRequired - Result type for operations that always return a value (findFirstOrThrow, etc.)
 */
type FlareResultRequired<T extends ModelName, Args> = FlareResult<T, Args, 'findFirstOrThrow'>;
`.trimStart();
}
