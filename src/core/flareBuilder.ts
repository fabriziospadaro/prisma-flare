import type { Prisma } from '@prisma/client';
import type {
  ModelName,
  ModelDelegate,
  RecordType,
  WhereInput,
  OrderByInput,
  SelectInput,
  DistinctInput,
  CreateData,
  CreateManyData,
  UpdateData,
  UpdateManyData,
  DeleteArgs,
  DeleteManyArgs,
  UpsertArgs,
  GroupByInput,
  HavingInput,
  SumFields,
  AvgFields,
  MinFields,
  MaxFields,
  QueryArgs,
  PaginatedResult
} from '../types';
import { IncludeKey } from '../types/prisma.types';
import { modelRegistry } from './modelRegistry';

/**
 * Deep clones an object, handling Date, BigInt, Buffer, Map, Set and other non-JSON-safe types.
 * Uses structuredClone when available (Node 17+), with a manual fallback.
 */
function deepClone<T>(obj: T): T {
  // Primitives and null
  if (obj === null || typeof obj !== 'object') {
    return obj;
  }

  // BigInt check must come before object check (typeof bigint !== 'object')
  // but keeping it here for clarity - it's actually caught above
  if (typeof obj === 'bigint') {
    return obj;
  }

  // Use structuredClone if available (Node 17+, modern browsers)
  if (typeof structuredClone === 'function') {
    try {
      return structuredClone(obj);
    } catch {
      // Fall through to manual clone for unsupported types
    }
  }

  // Manual deep clone fallback
  if (obj instanceof Date) {
    return new Date(obj.getTime()) as T;
  }

  if (obj instanceof RegExp) {
    return new RegExp(obj.source, obj.flags) as T;
  }

  // Buffer (Node.js)
  if (typeof Buffer !== 'undefined' && Buffer.isBuffer(obj)) {
    return Buffer.from(obj) as T;
  }

  // ArrayBuffer
  if (obj instanceof ArrayBuffer) {
    return obj.slice(0) as T;
  }

  // TypedArrays (Uint8Array, Int32Array, etc.)
  if (ArrayBuffer.isView(obj) && !(obj instanceof DataView)) {
    const TypedArrayConstructor = obj.constructor as new (buffer: ArrayBuffer) => typeof obj;
    // Handle SharedArrayBuffer (can't clone, just reference) vs ArrayBuffer (clone it)
    const buffer = obj.buffer instanceof ArrayBuffer ? obj.buffer.slice(0) : obj.buffer;
    return new TypedArrayConstructor(buffer as ArrayBuffer) as T;
  }

  // Map
  if (obj instanceof Map) {
    const clonedMap = new Map();
    obj.forEach((value, key) => {
      clonedMap.set(deepClone(key), deepClone(value));
    });
    return clonedMap as T;
  }

  // Set
  if (obj instanceof Set) {
    const clonedSet = new Set();
    obj.forEach(value => {
      clonedSet.add(deepClone(value));
    });
    return clonedSet as T;
  }

  // Arrays
  if (Array.isArray(obj)) {
    return obj.map(item => deepClone(item)) as T;
  }

  // Handle Prisma Decimal (has toDecimalPlaces method - immutable, safe to reuse)
  if (typeof (obj as any).toDecimalPlaces === 'function') {
    return obj;
  }

  // Plain object - use Object.create to preserve prototype chain
  const prototype = Object.getPrototypeOf(obj);
  const cloned: any = Object.create(prototype);
  for (const key in obj) {
    if (Object.prototype.hasOwnProperty.call(obj, key)) {
      cloned[key] = deepClone((obj as any)[key]);
    }
  }
  return cloned;
}

/**
 * Global interface for relation-to-model mapping.
 * This is augmented by prisma-flare/generated to provide type-safe includes.
 *
 * @example
 * // In your project, prisma-flare generate creates:
 * declare module 'prisma-flare' {
 *   interface RelationModelMap {
 *     posts: Post;
 *     author: User;
 *   }
 * }
 */
export interface RelationModelMap {
  // Using 'any' to allow model classes that extend FlareBuilder from different sources
  // (e.g., from prisma-flare-generated for custom output paths)
  [key: string]: any;
}

/**
 * Helper type to get the model class for a relation name
 */
type GetRelationModel<K extends string> = K extends keyof RelationModelMap
  ? RelationModelMap[K]
  : FlareBuilder<any, Record<string, never>>;

/**
 * FlareBuilder for chainable Prisma queries with full type safety
 * The type safety is enforced through the ModelDelegate parameter
 */
export default class FlareBuilder<T extends ModelName, Args extends Record<string, any> = Record<string, never>> {
  protected model: ModelDelegate<T>;
  protected query: QueryArgs;
  private deferred: Array<(target: this) => Promise<unknown>> = [];
  private resolution?: Promise<void>;
  private settling = false;

  constructor(model: ModelDelegate<T>, query: QueryArgs = {}) {
    this.model = model;
    this.query = query;
  }

  /**
   * Queues async work to run right before the query executes, so a scope backed
   * by raw SQL (or any other await) stays synchronously chainable.
   *
   * Return a where filter to have it merged into the query, or return nothing
   * and refine `this` directly. The resolver can set anything a scope can:
   * where, order, limit, select, include.
   *
   * @param resolver - Async function that refines the query before it runs
   *
   * @example
   * // Return a filter and it gets merged:
   * recentlyActive(days: number) {
   *   return this.defer(async () => {
   *     const rows = await db.$queryRaw<{ id: string }[]>`
   *       SELECT DISTINCT "userId" AS id FROM "Session"
   *       WHERE "createdAt" > NOW() - ${days} * INTERVAL '1 day'`;
   *     return { id: { in: rows.map((r) => r.id) } };
   *   });
   * }
   *
   * @example
   * // Or refine `this` for anything that isn't a filter:
   * costliestFirst() {
   *   return this.defer(async () => {
   *     const rows = await db.$queryRaw<{ id: string }[]>`...`;
   *     this.where({ id: { in: rows.map((r) => r.id) } }).order({ total: 'desc' }).limit(10);
   *   });
   * }
   */
  defer(resolver: (qb: this) => Promise<WhereInput<T> | void>): this;

  /**
   * Field shorthand: resolve rows, pluck `field` from each, and filter the
   * query to those values. Covers the common "raw SQL returns ids" case without
   * a map() or a hand-written `in` filter.
   *
   * Rows may be objects containing the field, or the bare values themselves.
   *
   * @param field - Field to filter on, and the column plucked from each row
   * @param resolver - Async function returning the rows (or values)
   *
   * @example
   * random(n = 1) {
   *   return this.defer('id', () => db.$queryRaw`
   *     SELECT id FROM "User" ORDER BY RANDOM() LIMIT ${n}`);
   * }
   *
   * // Chains like any other scope, no await needed mid-chain:
   * await DB.users.random(4).active().order({ name: 'asc' }).findMany();
   */
  defer<K extends keyof RecordType<T> & string>(
    field: K,
    resolver: () => Promise<Array<Record<K, RecordType<T>[K]> | RecordType<T>[K]>>
  ): this;

  defer(
    fieldOrResolver: string | ((qb: this) => Promise<unknown>),
    maybeResolver?: () => Promise<unknown[]>
  ): this {
    if (typeof fieldOrResolver === 'string') {
      const field = fieldOrResolver;
      const resolver = maybeResolver!;
      this.deferred.push(async (target) => {
        const rows = await resolver();
        const values = rows.map((row) => {
          if (row === null || typeof row !== 'object') return row;
          const keys = Object.keys(row);
          if (field in row) return (row as Record<string, unknown>)[field];
          // A single-column row is unambiguous, so accept it under any alias.
          if (keys.length === 1) return (row as Record<string, unknown>)[keys[0]];
          // Typed rows are caught at compile time; this only fires for `any`,
          // which is what $queryRaw hands back unless the caller annotates it.
          throw new Error(
            `prisma-flare: defer('${field}', ...) received a row without a '${field}' property ` +
              `(found: ${keys.join(', ')}). Alias the column as "${field}" in your query, ` +
              `or return the values directly.`
          );
        });
        // Prisma rejects null inside `in`, and SQL `IN` never matches NULL
        // anyway, so a NULL row (outer join miss, nullable FK) is dropped
        // rather than turned into a filter the caller did not ask for.
        const present = values.filter((value) => value !== null && value !== undefined);

        target.where({ [field]: { in: present } } as WhereInput<T>);
      });
      return this;
    }

    const resolver = fieldOrResolver;
    this.deferred.push(async (target) => {
      const filter = await resolver(target);
      if (filter) target.where(filter as WhereInput<T>);
    });
    return this;
  }

  /**
   * Single execution funnel for every terminal method.
   *
   * Settles queued defer() callbacks, then hands the finished query to the
   * delegate call. Terminals build their arguments inside the callback, so the
   * query they send always reflects whatever the resolvers added.
   */
  protected async execute<R>(run: (query: QueryArgs) => Promise<R> | R): Promise<R> {
    await this.settle();
    return run(this.query);
  }

  /**
   * Runs any defer() callbacks that haven't run yet, exactly once each.
   *
   * New work registered after an execution chains onto the previous resolution,
   * which keeps registration order intact and makes a failed resolver sticky
   * rather than silently retried by the next terminal. Terminals sharing a
   * builder await the same resolution, so the raw queries are never duplicated.
   *
   * A resolver must not run a terminal on the builder it is resolving, since
   * that query is still being assembled. That would deadlock, so it throws
   * instead: query a different builder or the raw client.
   */
  private settle(): Promise<void> {
    if (this.settling) {
      return Promise.reject(
        new Error(
          'prisma-flare: a defer() resolver executed a query on the builder it is resolving. ' +
            'Use a separate builder or the raw client inside the resolver.'
        )
      );
    }

    if (this.deferred.length === 0) {
      return this.resolution ?? Promise.resolve();
    }

    const pending = this.deferred;
    this.deferred = [];

    this.resolution = (this.resolution ?? Promise.resolve()).then(async () => {
      this.settling = true;
      try {
        for (const resolver of pending) await resolver(this);
      } finally {
        this.settling = false;
      }
    });

    return this.resolution;
  }

  /**
   * Adds a where condition to the query with type safety from Prisma.
   * Multiple where() calls are composed using AND logic to avoid silent overwrites.
   * @param condition - Where filter matching your Prisma model
   * 
   * @example
   * // These conditions are AND-ed together:
   * DB.posts
   *   .where({ published: true })
   *   .where({ authorId: 1 })
   *   .findMany()
   * // Equivalent to: { AND: [{ published: true }, { authorId: 1 }] }
   */
  where(condition: WhereInput<T>): this {
    if (!this.query.where || Object.keys(this.query.where).length === 0) {
      // First where condition - set directly
      this.query.where = condition as any;
    } else {
      // Compose with AND to avoid silent overwrites
      const prevWhere = this.query.where;
      this.query.where = { AND: [prevWhere, condition] } as any;
    }
    return this;
  }

  /**
   * Adds a where condition using AND logic (explicit alias for where())
   * @param condition - Where filter matching your Prisma model
   * 
   * @example
   * DB.posts
   *   .where({ published: true })
   *   .andWhere({ createdAt: { gte: new Date('2024-01-01') } })
   *   .findMany()
   */
  andWhere(condition: WhereInput<T>): this {
    return this.where(condition);
  }

  /**
   * Adds a where condition using OR logic.
   * 
   * ⚠️ **IMPORTANT**: `orWhere()` wraps the *entire* accumulated where clause:
   * `OR([prevWhere, condition])`. This means:
   * 
   * ```ts
   * .where(A).orWhere(B).where(C)  // becomes: (A OR B) AND C
   * ```
   * 
   * For complex boolean logic, prefer `whereGroup()` / `orWhereGroup()` for explicit control.
   * 
   * @param condition - Where filter matching your Prisma model
   * 
   * @example
   * // Simple case - OK:
   * DB.posts
   *   .where({ published: true })
   *   .orWhere({ featured: true })
   *   .findMany()
   * // Result: published OR featured
   * 
   * @example
   * // For complex logic, use whereGroup instead:
   * DB.posts
   *   .where({ published: true })
   *   .whereGroup(qb => qb
   *     .where({ category: 'news' })
   *     .orWhere({ category: 'tech' })
   *   )
   *   .findMany()
   * // Result: published AND (category='news' OR category='tech')
   */
  orWhere(condition: WhereInput<T>): this {
    if (!this.query.where || Object.keys(this.query.where).length === 0) {
      this.query.where = condition as any;
    } else {
      const prevWhere = this.query.where;
      this.query.where = { OR: [prevWhere, condition] } as any;
    }
    return this;
  }

  /**
   * Creates a grouped where condition using a callback.
   * Use this for explicit control over boolean logic grouping.
   * The callback receives a fresh builder - its accumulated where becomes a single group.
   * 
   * @param callback - Function that builds the grouped condition
   * @param mode - How to combine with existing where: 'AND' (default) or 'OR'
   * 
   * @example
   * // (status = 'active') AND (name LIKE 'A%' OR name LIKE 'B%')
   * DB.users
   *   .where({ status: 'active' })
   *   .whereGroup(qb => qb
   *     .where({ name: { startsWith: 'A' } })
   *     .orWhere({ name: { startsWith: 'B' } })
   *   )
   *   .findMany()
   * 
   * @example
   * // (status = 'active') OR (role = 'admin' AND verified = true)
   * DB.users
   *   .where({ status: 'active' })
   *   .whereGroup(qb => qb
   *     .where({ role: 'admin' })
   *     .where({ verified: true })
   *   , 'OR')
   *   .findMany()
   */
  whereGroup(
    callback: (builder: FlareBuilder<T, Record<string, never>>) => FlareBuilder<T, any>,
    mode: 'AND' | 'OR' = 'AND'
  ): this {
    // Create a fresh builder for the group
    const groupBuilder = new FlareBuilder<T, Record<string, never>>(this.model, {});
    callback(groupBuilder);

    const groupWhere = groupBuilder.getQuery().where;

    if (!groupWhere || Object.keys(groupWhere).length === 0) {
      return this;
    }

    if (!this.query.where || Object.keys(this.query.where).length === 0) {
      this.query.where = groupWhere;
    } else {
      const prevWhere = this.query.where;
      this.query.where = { [mode]: [prevWhere, groupWhere] } as any;
    }

    return this;
  }

  /**
   * Alias for whereGroup with OR mode.
   * Creates a grouped condition that's OR-ed with existing where.
   * 
   * @param callback - Function that builds the grouped condition
   * 
   * @example
   * // (published = true) OR (authorId = 1 AND draft = true)
   * DB.posts
   *   .where({ published: true })
   *   .orWhereGroup(qb => qb
   *     .where({ authorId: 1 })
   *     .where({ draft: true })
   *   )
   *   .findMany()
   */
  orWhereGroup(
    callback: (builder: FlareBuilder<T, Record<string, never>>) => FlareBuilder<T, any>
  ): this {
    return this.whereGroup(callback, 'OR');
  }

  /**
   * Adds a where condition to the query for the specified id.
   * Uses the same AND composition as where() for consistency.
   * @param id - The id to search for
   */
  withId(id: number | string): this {
    if (!id) {
      throw new Error('Id is required');
    }
    // Compose using where() for consistent AND logic
    if (!this.query.where || Object.keys(this.query.where).length === 0) {
      this.query.where = { id } as any;
    } else {
      const prevWhere = this.query.where;
      this.query.where = { AND: [prevWhere, { id }] } as any;
    }
    return this;
  }

  /**
   * Adds an order by condition to the query
   * @param orderBy - OrderBy object matching your Prisma model
   */
  order(orderBy: OrderByInput<T>): this {
    this.query.orderBy = orderBy;
    return this;
  }

  /**
   * Gets the last record sorted by the specified field
   * @param key - Field to sort by (defaults to 'createdAt')
   */
  last(key: keyof RecordType<T> | string = 'createdAt'): this {
    return this.order({ [key as string]: 'desc' } as any).limit(1);
  }

  /**
   * Gets the first record sorted by the specified field
   * @param key - Field to sort by (defaults to 'createdAt')
   */
  first(key: keyof RecordType<T> | string = 'createdAt'): this {
    return this.order({ [key as string]: 'asc' } as any).limit(1);
  }

  /**
   * Sets a limit on the number of records to retrieve
   * @param limit - Maximum number of records
   */
  limit(limit: number): this {
    this.query.take = limit;
    return this;
  }

  /**
   * Sets distinct fields for the query
   * @param distinct - Fields to be distinct
   */
  distinct(distinct: DistinctInput<T>): this {
    this.query.distinct = distinct;
    return this;
  }

  /**
   * Selects specific fields to retrieve
   * @param fields - Select object matching your Prisma model
   */
  select<S extends SelectInput<T>>(fields: S): FlareBuilder<T, Args & { select: S }> {
    this.query.select = fields;
    return this as any;
  }

  /**
   * Selects only the specified field and returns its value
   * @param field - Field name to retrieve
   */
  async only<K extends keyof RecordType<T>>(
    field: K
  ): Promise<RecordType<T>[K] | null> {
    return this.execute(async (query) => {
      query.select = { [field]: true };
      const result = await (this.model as any).findFirst(query);
      return result ? (result[field] as RecordType<T>[K]) : null;
    });
  }

  /**
   * Returns the current query object.
   *
   * Note: work queued by defer() resolves at execution time, so it is absent
   * here until a terminal method has run. Await the query first if you are
   * inspecting a builder that uses deferred scopes.
   */
  getQuery(): QueryArgs {
    return this.query;
  }

  /**
 * Includes a relation (typed from Prisma's `include` args)
 */
  include<K extends IncludeKey<T>>(
    relation: K
  ): FlareBuilder<T, Args & { include: { [P in K]: true } }>;

  /**
   * Includes a relation with query customization using a builder.
   * The callback receives the custom model class if registered via prisma-flare generate.
   * Type inference is automatic when RelationModelMap is properly augmented.
   * 
   * @example
   * // Type-safe includes with custom methods (automatic after prisma-flare generate):
   * .include("posts", (posts) => posts.published().recent(5))
   * .include("author", (author) => author.withEmail("test@example.com"))
   */
  include<
    K extends IncludeKey<T>,
    R extends FlareBuilder<any, any>
  >(
    relation: K,
    callback: (builder: GetRelationModel<K & string>) => R
  ): FlareBuilder<T, Args & { include: { [P in K]: R extends FlareBuilder<any, infer RA> ? RA : true } }>;

  include<K extends IncludeKey<T>>(
    relation: K,
    callback?: (builder: any) => any
  ): FlareBuilder<T, Args & { include: Record<string, any> }> {
    let relationQuery: any = true;

    if (callback) {
      // Try to get the custom model class from the registry
      // The relation name is typically the singular/plural form of the model name
      const builder = modelRegistry.create(relation as string)
        ?? new FlareBuilder<any>(null as any);
      callback(builder);

      // A relation scope may be deferred (raw SQL, an external service). The
      // nested builder is never executed, so adopt its pending work and settle
      // it against the relation's own query before this query runs.
      const nested = builder as FlareBuilder<any, any>;
      const pending = nested.deferred;
      if (pending.length > 0) {
        nested.deferred = [];
        this.deferred.push(async () => {
          for (const resolver of pending) await resolver(nested);
          const resolved = nested.getQuery();
          (this.query.include as any)[relation] =
            Object.keys(resolved).length === 0 ? true : resolved;
        });
      }

      relationQuery = builder.getQuery();

      if (Object.keys(relationQuery).length === 0) {
        relationQuery = true;
      }
    }

    this.query.include = {
      ...(this.query.include as any),
      [relation]: relationQuery
    };

    return this as any;
  }

  /**
   * Groups results by specified fields
   * @param groupBy - Fields to group by
   */
  groupBy(groupBy: GroupByInput<T>): FlareBuilder<T, Args & { by: GroupByInput<T> }> {
    (this.query as any).by = groupBy;
    return this as any;
  }

  /**
   * Adds a having condition to the query
   * @param condition - Having condition
   */
  having(condition: HavingInput<T>): FlareBuilder<T, Args & { having: HavingInput<T> }> {
    this.query.having = condition;
    return this as any;
  }

  /**
   * Skips the specified number of records
   * @param offset - Number of records to skip
   */
  skip(offset: number): this {
    this.query.skip = offset;
    return this;
  }

  /**
   * Checks if any record exists matching the current query
   * @param existenceKey - Key to check for existence (defaults to 'id')
   */
  async exists(existenceKey = 'id'): Promise<boolean> {
    return this.execute(async (query) => {
      const result = await (this.model as any).findFirst({
        where: query.where,
        select: { [existenceKey]: true },
      });
      return Boolean(result);
    });
  }

  /**
   * Paginates the results
   * @param page - Page number (1-based)
   * @param perPage - Number of records per page
   */
  async paginate(page: number = 1, perPage: number = 15): Promise<PaginatedResult<Prisma.Result<ModelDelegate<T>, Args, 'findFirstOrThrow'>>> {
    return this.execute(async (query) => {
      query.skip = (page - 1) * perPage;
      query.take = perPage;

      const [data, total] = await Promise.all([
        (this.model as any).findMany(query),
        (this.model as any).count({ where: query.where }),
      ]);

      const lastPage = Math.ceil(total / perPage);

      return {
        data,
        meta: {
          total,
          lastPage,
          currentPage: page,
          perPage,
          prev: page > 1 ? page - 1 : null,
          next: page < lastPage ? page + 1 : null,
        },
      };
    });
  }

  /**
   * Conditionally executes a callback on the query builder
   * @param condition - Boolean or function returning boolean
   * @param callback - Function to execute if condition is true
   */
  when(
    condition: boolean | (() => boolean),
    callback: (qb: this) => void
  ): this {
    const isTrue = typeof condition === 'function' ? condition() : condition;
    if (isTrue) {
      callback(this);
    }
    return this;
  }

  /**
   * Processes results in chunks to avoid memory issues
   * @param size - Size of each chunk
   * @param callback - Function to process each chunk
   */
  async chunk(
    size: number,
    callback: (results: Prisma.Result<ModelDelegate<T>, Args, 'findMany'>) => Promise<void> | void
  ): Promise<void> {
    return this.execute(async (query) => {
      let page = 1;
      let hasMore = true;

      const originalSkip = query.skip;
      const originalTake = query.take;

      while (hasMore) {
        query.skip = (page - 1) * size;
        query.take = size;

        const results = await (this.model as any).findMany(query);

        if (results.length > 0) {
          await callback(results);
          page++;

          if (results.length < size) {
            hasMore = false;
          }
        } else {
          hasMore = false;
        }
      }

      query.skip = originalSkip;
      query.take = originalTake;
    });
  }

  /**
   * Clones the current query builder instance.
   * Uses structuredClone for proper handling of Date, BigInt, etc.
   *
   * The clone keeps the runtime class of the original, so custom model scopes
   * stay available on it. Unresolved defer() callbacks are copied so each clone
   * resolves them against its own query instead of sharing a resolved result.
   */
  clone(): this {
    const copy = Object.create(Object.getPrototypeOf(this)) as this;
    copy.model = this.model;
    copy.query = deepClone(this.query);
    copy.deferred = [...this.deferred];
    copy.resolution = undefined;
    copy.settling = false;
    return copy;
  }

  /**
   * Finds the first record matching the query or throws an error if none found
   * Throws a Prisma NotFoundError if no record matches the query
   * @throws {Prisma.NotFoundError} When no record matches the query
   * @returns Promise resolving to the found record
   */
  async findFirstOrThrow(): Promise<Prisma.Result<ModelDelegate<T>, Args, 'findFirstOrThrow'>> {
    return this.execute((query) => (this.model as any).findFirstOrThrow(query));
  }

  /**
   * Finds a unique record by primary key or throws an error if not found
   * Requires a unique constraint (typically the id field)
   * Throws a Prisma NotFoundError if no record matches
   * @throws {Prisma.NotFoundError} When no record is found
   * @returns Promise resolving to the found record
   */
  async findUniqueOrThrow(): Promise<Prisma.Result<ModelDelegate<T>, Args, 'findUniqueOrThrow'>> {
    return this.execute((query) => (this.model as any).findUniqueOrThrow(query));
  }

  /**
   * Finds all records matching the query
   * Respects all previously set query conditions (where, orderBy, take, skip, include, select, distinct)
   * @returns Promise resolving to an array of records matching the query
   */
  async findMany(): Promise<Prisma.Result<ModelDelegate<T>, Args, 'findMany'>> {
    return this.execute((query) => (this.model as any).findMany(query));
  }

  /**
   * Finds the first record matching the query
   * Returns null if no record matches. To throw an error instead, use findFirstOrThrow()
   * @returns Promise resolving to the first matching record or null
   */
  async findFirst(): Promise<Prisma.Result<ModelDelegate<T>, Args, 'findFirst'>> {
    return this.execute((query) => (this.model as any).findFirst(query));
  }

  /**
   * Finds a unique record by primary key
   * Returns null if no record is found. To throw an error instead, use findUniqueOrThrow()
   * Requires a unique constraint in the where condition (typically the id field)
   * @returns Promise resolving to the found record or null
   */
  async findUnique(): Promise<Prisma.Result<ModelDelegate<T>, Args, 'findUnique'>> {
    return this.execute((query) => (this.model as any).findUnique(query));
  }

  /**
   * Creates a new record with the provided data
   * Any hooks registered for 'create' operations will be triggered
   * @param data - Data matching your Prisma model's create input
   * @returns Promise resolving to the newly created record
   */
  async create(data: CreateData<T>): Promise<Prisma.Result<ModelDelegate<T>, Args, 'create'>> {
    return this.execute((q) => (this.model as any).create({ ...q, data }));
  }

  /**
   * Creates multiple records in a single operation
   * More efficient than creating records individually
   * Any hooks registered for 'create' operations will be triggered for each record
   * @param data - Array of data objects matching your Prisma model's create input
   * @returns Promise resolving to the count of created records
   */
  async createMany(data: CreateManyData<T>): Promise<Prisma.Result<ModelDelegate<T>, Args, 'createMany'>> {
    return this.execute((q) => (this.model as any).createMany({ ...q, data }));
  }

  /**
   * Deletes a single record matching the current query conditions
   * Requires at least one unique constraint in the where condition (typically id)
   * Any hooks registered for 'delete' operations will be triggered
   * @param args - Optional additional delete arguments to override query conditions
   * @returns Promise resolving to the deleted record
   */
  async delete(args?: DeleteArgs<T>): Promise<Prisma.Result<ModelDelegate<T>, Args, 'delete'>> {
    return this.execute((q) => (this.model as any).delete(args ? { ...q, ...args } : q));
  }

  /**
   * Deletes multiple records matching the current query conditions
   * More efficient than deleting records individually
   * Any hooks registered for 'delete' operations will be triggered for each record
   * @param args - Optional additional delete arguments to override query conditions
   * @returns Promise resolving to the count of deleted records
   */
  async deleteMany(args?: DeleteManyArgs<T>): Promise<Prisma.Result<ModelDelegate<T>, Args, 'deleteMany'>> {
    return this.execute((q) => (this.model as any).deleteMany(args ? { ...q, ...args } : q));
  }

  /**
   * Updates a single record matching the current query conditions
   * Requires at least one unique constraint in the where condition (typically id)
   * Any hooks registered for 'update' operations will be triggered
   * @param data - Data to update, matching your Prisma model's update input
   * @returns Promise resolving to the updated record
   */
  async update(data: UpdateData<T>): Promise<Prisma.Result<ModelDelegate<T>, Args, 'update'>> {
    return this.execute((q) => (this.model as any).update({ ...q, data }));
  }

  /**
   * Updates multiple records matching the current query conditions
   * More efficient than updating records individually
   * Any hooks registered for 'update' operations will be triggered for each record
   * @param data - Data to update, matching your Prisma model's update input
   * @returns Promise resolving to the count of updated records
   */
  async updateMany(data: UpdateManyData<T>): Promise<Prisma.Result<ModelDelegate<T>, Args, 'updateMany'>> {
    return this.execute((q) => (this.model as any).updateMany({ ...q, data }));
  }

  /**
   * Updates a record if it exists, otherwise creates a new record
   * The record is uniquely identified by the where condition (typically id)
   * Any hooks registered for 'update' or 'create' operations will be triggered accordingly
   * @param args - Optional upsert arguments including where, update, and create data
   * @returns Promise resolving to the upserted record
   */
  async upsert(args?: UpsertArgs<T>): Promise<Prisma.Result<ModelDelegate<T>, Args, 'upsert'>> {
    return this.execute((q) => (this.model as any).upsert(args ? { ...q, ...args } : q));
  }

  /**
   * Counts the number of records matching the query
   */
  async count(): Promise<number> {
    return this.execute((query) => (this.model as any).count(query));
  }

  /**
   * Sums the specified numeric field
   * @param field - Field name to sum
   */
  async sum(field: SumFields<T> & string): Promise<number | null> {
    return this.execute(async (query) => {
      const result = await (this.model as any).aggregate({
        _sum: { [field]: true },
        where: query.where,
      });
      return result._sum[field];
    });
  }

  /**
   * Calculates the average of the specified numeric field
   * @param field - Field name to average
   */
  async avg(field: AvgFields<T> & string): Promise<number | null> {
    return this.execute(async (query) => {
      const result = await (this.model as any).aggregate({
        _avg: { [field]: true },
        where: query.where,
      });
      return result._avg[field];
    });
  }

  /**
   * Finds the minimum value of the specified field
   * @param field - Field name to find minimum
   */
  async min(field: MinFields<T> & string): Promise<any> {
    return this.execute(async (query) => {
      const result = await (this.model as any).aggregate({
        _min: { [field]: true },
        where: query.where,
      });
      return result._min[field];
    });
  }

  /**
   * Finds the maximum value of the specified field
   * @param field - Field name to find maximum
   */
  async max(field: MaxFields<T> & string): Promise<any> {
    return this.execute(async (query) => {
      const result = await (this.model as any).aggregate({
        _max: { [field]: true },
        where: query.where,
      });
      return result._max[field];
    });
  }

  /**
   * Plucks the specified field from all results
   * @param field - Field name to pluck
   */
  async pluck<K extends keyof RecordType<T>>(field: K): Promise<RecordType<T>[K][]> {
    return this.execute(async (query) => {
      query.select = { [field]: true };
      const results = await (this.model as any).findMany(query);
      return results.map((result: any) => result[field]);
    });
  }
}
