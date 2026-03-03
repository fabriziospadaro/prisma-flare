/**
 * Generates FlareBuilder interface definitions.
 *
 * This is the single source of truth for FlareBuilder method signatures.
 * When adding new methods to FlareBuilder, add them here and the generated
 * types will automatically include them.
 */

export interface FlareBuilderMethod {
  name: string;
  /** Signature can be a string or a function that takes prismaNamespace */
  signature: string | ((prismaNamespace: string) => string);
  /** Optional JSDoc comment */
  comment?: string;
}

/**
 * All FlareBuilder methods organized by category.
 * This is the single source of truth - update here when adding new methods.
 *
 * For return types that depend on select/include inference, use a function
 * that takes the prismaNamespace to generate the proper Prisma.Result type.
 */
export const FLARE_BUILDER_METHODS = {
  whereConditions: [
    {
      name: 'where',
      signature: '(condition: WhereInput<T>): this',
    },
    {
      name: 'andWhere',
      signature: '(condition: WhereInput<T>): this',
    },
    {
      name: 'orWhere',
      signature: '(condition: WhereInput<T>): this',
    },
    {
      name: 'whereGroup',
      signature:
        "(callback: (builder: FlareBuilder<T, Record<string, never>>) => FlareBuilder<T, any>, mode?: 'AND' | 'OR'): this",
    },
    {
      name: 'orWhereGroup',
      signature:
        '(callback: (builder: FlareBuilder<T, Record<string, never>>) => FlareBuilder<T, any>): this',
    },
    {
      name: 'withId',
      signature: '(id: number | string): this',
    },
  ],
  orderingAndLimiting: [
    {
      name: 'order',
      signature: '(orderBy: OrderByInput<T>): this',
    },
    {
      name: 'first',
      signature: '(key?: keyof RecordType<T> | string): this',
    },
    {
      name: 'last',
      signature: '(key?: keyof RecordType<T> | string): this',
    },
    {
      name: 'limit',
      signature: '(count: number): this',
    },
    {
      name: 'skip',
      signature: '(count: number): this',
    },
    {
      name: 'distinct',
      signature: '(fields: DistinctInput<T>): this',
    },
  ],
  selection: [
    {
      name: 'select',
      signature: '<S extends SelectInput<T>>(fields: S): FlareBuilder<T, Args & { select: S }>',
    },
    {
      name: 'include',
      signature:
        '<K extends IncludeKey<T>, NestedArgs extends Record<string, any> = {}>(relation: K, callback?: (builder: FlareBuilder<RelationModelName<T, K>, {}>) => FlareBuilder<RelationModelName<T, K>, NestedArgs>): FlareBuilder<T, Args & { include: Record<K, keyof NestedArgs extends never ? true : NestedArgs> }>',
    },
  ],
  readOperations: [
    {
      name: 'findMany',
      // Use custom FlareResultMany for proper include type inference in new provider
      // Falls back to Prisma.Result for old provider via prismaNamespace
      signature: (ns: string, useFlareResult?: boolean) =>
        useFlareResult
          ? `(): Promise<FlareResultMany<T, Args>>`
          : `(): Promise<${ns}.Result<ModelDelegate<T>, Args, 'findMany'>>`,
    },
    {
      name: 'findFirst',
      signature: (ns: string, useFlareResult?: boolean) =>
        useFlareResult
          ? `(): Promise<FlareResultNullable<T, Args>>`
          : `(): Promise<${ns}.Result<ModelDelegate<T>, Args, 'findFirst'>>`,
    },
    {
      name: 'findFirstOrThrow',
      signature: (ns: string, useFlareResult?: boolean) =>
        useFlareResult
          ? `(): Promise<FlareResultRequired<T, Args>>`
          : `(): Promise<${ns}.Result<ModelDelegate<T>, Args, 'findFirstOrThrow'>>`,
    },
    {
      name: 'findUnique',
      signature: (ns: string, useFlareResult?: boolean) =>
        useFlareResult
          ? `(): Promise<FlareResultNullable<T, Args>>`
          : `(): Promise<${ns}.Result<ModelDelegate<T>, Args, 'findUnique'>>`,
    },
    {
      name: 'findUniqueOrThrow',
      signature: (ns: string, useFlareResult?: boolean) =>
        useFlareResult
          ? `(): Promise<FlareResultRequired<T, Args>>`
          : `(): Promise<${ns}.Result<ModelDelegate<T>, Args, 'findUniqueOrThrow'>>`,
    },
    {
      name: 'pluck',
      signature: '<K extends keyof RecordType<T>>(field: K): Promise<Array<RecordType<T>[K]>>',
    },
    {
      name: 'only',
      signature: '<K extends keyof RecordType<T>>(field: K): Promise<RecordType<T>[K] | null>',
    },
  ],
  writeOperations: [
    {
      name: 'create',
      signature: (ns: string) => `(data: CreateData<T>): Promise<${ns}.Result<ModelDelegate<T>, Args, 'create'>>`,
    },
    {
      name: 'createMany',
      signature: (ns: string) => `(data: CreateManyData<T>): Promise<${ns}.Result<ModelDelegate<T>, Args, 'createMany'>>`,
    },
    {
      name: 'update',
      signature: (ns: string) => `(data: UpdateData<T>): Promise<${ns}.Result<ModelDelegate<T>, Args, 'update'>>`,
    },
    {
      name: 'updateMany',
      signature: (ns: string) => `(data: UpdateData<T>): Promise<${ns}.Result<ModelDelegate<T>, Args, 'updateMany'>>`,
    },
    {
      name: 'upsert',
      signature: (ns: string) => `(args?: UpsertArgs<T>): Promise<${ns}.Result<ModelDelegate<T>, Args, 'upsert'>>`,
    },
    {
      name: 'delete',
      signature: (ns: string) => `(args?: DeleteArgs<T>): Promise<${ns}.Result<ModelDelegate<T>, Args, 'delete'>>`,
    },
    {
      name: 'deleteMany',
      signature: (ns: string) => `(args?: DeleteManyArgs<T>): Promise<${ns}.Result<ModelDelegate<T>, Args, 'deleteMany'>>`,
    },
  ],
  aggregations: [
    {
      name: 'count',
      signature: '(): Promise<number>',
    },
    {
      name: 'sum',
      signature: '<F extends SumFields<T>>(field: F): Promise<number | null>',
    },
    {
      name: 'avg',
      signature: '<F extends AvgFields<T>>(field: F): Promise<number | null>',
    },
    {
      name: 'min',
      signature: '<F extends MinFields<T>>(field: F): Promise<any>',
    },
    {
      name: 'max',
      signature: '<F extends MaxFields<T>>(field: F): Promise<any>',
    },
    {
      name: 'aggregate',
      signature:
        '(args: { _sum?: Partial<Record<SumFields<T>, true>>; _avg?: Partial<Record<AvgFields<T>, true>>; _min?: Partial<Record<MinFields<T>, true>>; _max?: Partial<Record<MaxFields<T>, true>>; _count?: boolean | Partial<Record<string, true>> }): Promise<any>',
    },
    {
      name: 'groupBy',
      signature: '<B extends GroupByInput<T>>(by: B): FlareBuilder<T, Args & { by: B }>',
    },
    {
      name: 'having',
      signature: '(condition: HavingInput<T>): FlareBuilder<T, Args & { having: HavingInput<T> }>',
    },
  ],
  pagination: [
    {
      name: 'paginate',
      signature: (ns: string, useFlareResult?: boolean) =>
        useFlareResult
          ? `(page?: number, perPage?: number): Promise<PaginatedResult<FlareResult<T, Args>>>`
          : `(page?: number, perPage?: number): Promise<PaginatedResult<${ns}.Result<ModelDelegate<T>, Args, 'findFirstOrThrow'>>>`,
    },
  ],
  existence: [
    {
      name: 'exists',
      signature: '(existenceKey?: string): Promise<boolean>',
    },
  ],
  utilities: [
    {
      name: 'when',
      signature:
        '(condition: boolean | (() => boolean), callback: (qb: this) => void): this',
    },
    {
      name: 'chunk',
      signature: (ns: string, useFlareResult?: boolean) =>
        useFlareResult
          ? `(size: number, callback: (results: FlareResultMany<T, Args>) => Promise<void> | void): Promise<void>`
          : `(size: number, callback: (results: ${ns}.Result<ModelDelegate<T>, Args, 'findMany'>) => Promise<void> | void): Promise<void>`,
    },
    {
      name: 'clone',
      signature: '(): FlareBuilder<T, Args>',
    },
    {
      name: 'getQuery',
      signature: '(): Record<string, any>',
    },
  ],
} as const;

/**
 * Gets all FlareBuilder methods as a flat array.
 */
export function getAllMethods(): FlareBuilderMethod[] {
  return Object.values(FLARE_BUILDER_METHODS).flat();
}

/**
 * Resolves a method signature, calling it with prismaNamespace and useFlareResult if it's a function.
 */
function resolveSignature(
  sig: string | ((ns: string, useFlareResult?: boolean) => string),
  prismaNamespace: string,
  useFlareResult: boolean
): string {
  return typeof sig === 'function' ? sig(prismaNamespace, useFlareResult) : sig;
}

export interface FlareBuilderInterfaceOptions {
  /** Whether to generate an interface (true) or declare class (false) */
  asInterface?: boolean;
  /** Interface/class name */
  name?: string;
  /** Whether to export */
  shouldExport?: boolean;
  /** Generic type parameters */
  generics?: string;
  /** Constructor signature (only for declare class) */
  constructorSignature?: string;
  /** Prisma namespace name (e.g., 'Prisma' or 'BasePrisma') for Result type inference */
  prismaNamespace?: string;
  /**
   * Use custom FlareResult types instead of Prisma.Result for read operations.
   * This fixes the issue where Prisma.Result doesn't work correctly with generic types
   * in the new prisma-client provider.
   */
  useFlareResult?: boolean;
}

/**
 * Generates FlareBuilder interface/class declaration.
 */
export function generateFlareBuilderInterface(options: FlareBuilderInterfaceOptions = {}): string {
  const {
    asInterface = true,
    name = 'FlareBuilder',
    shouldExport = true,
    generics = "<T extends ModelName, Args extends Record<string, any> = Record<string, never>>",
    constructorSignature,
    prismaNamespace = 'Prisma',
    useFlareResult = false,
  } = options;

  const exportKeyword = shouldExport ? 'export ' : '';
  const keyword = asInterface ? 'interface' : 'declare class';
  const methods = getAllMethods();

  const formatMethod = (m: FlareBuilderMethod) =>
    `  ${m.name}${resolveSignature(m.signature, prismaNamespace, useFlareResult)};`;

  const constructorLine = !asInterface && constructorSignature ? `  constructor${constructorSignature};\n\n` : '';

  // Protected members for subclasses to access
  const protectedMembers = !asInterface ? `  // Protected members for subclassing
  protected model: ModelDelegate<T>;
  protected query: Record<string, any>;

` : '';

  return `
// ============================================================================
// FlareBuilder - Complete type definition using YOUR Prisma types
// ============================================================================

/**
 * FlareBuilder provides a fluent query builder API with full type safety.
 * This version uses your project's Prisma types for complete autocomplete support.
 */
${exportKeyword}${keyword} ${name}${generics} {
${constructorLine}${protectedMembers}  // Query Building Methods - Where conditions
${methods
  .filter((m) => FLARE_BUILDER_METHODS.whereConditions.some((wc) => wc.name === m.name))
  .map(formatMethod)
  .join('\n')}

  // Query Building Methods - Ordering and Limiting
${methods
  .filter((m) => FLARE_BUILDER_METHODS.orderingAndLimiting.some((ol) => ol.name === m.name))
  .map(formatMethod)
  .join('\n')}

  // Query Building Methods - Selection
${methods
  .filter((m) => FLARE_BUILDER_METHODS.selection.some((s) => s.name === m.name))
  .map(formatMethod)
  .join('\n')}

  // Read Operations
${methods
  .filter((m) => FLARE_BUILDER_METHODS.readOperations.some((ro) => ro.name === m.name))
  .map(formatMethod)
  .join('\n')}

  // Write Operations
${methods
  .filter((m) => FLARE_BUILDER_METHODS.writeOperations.some((wo) => wo.name === m.name))
  .map(formatMethod)
  .join('\n')}

  // Aggregations
${methods
  .filter((m) => FLARE_BUILDER_METHODS.aggregations.some((a) => a.name === m.name))
  .map(formatMethod)
  .join('\n')}

  // Pagination
${methods
  .filter((m) => FLARE_BUILDER_METHODS.pagination.some((p) => p.name === m.name))
  .map(formatMethod)
  .join('\n')}

  // Existence Check
${methods
  .filter((m) => FLARE_BUILDER_METHODS.existence.some((e) => e.name === m.name))
  .map(formatMethod)
  .join('\n')}

  // Utilities
${methods
  .filter((m) => FLARE_BUILDER_METHODS.utilities.some((u) => u.name === m.name))
  .map(formatMethod)
  .join('\n')}
}
`.trimStart();
}
