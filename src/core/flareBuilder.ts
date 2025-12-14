import { Prisma } from '@prisma/client';
import type {
  ModelName,
  ModelDelegate,
  RecordType,
  WhereInput,
  OrderByInput,
  SelectInput,
  IncludeInput,
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

/**
 * FlareBuilder for chainable Prisma queries with full type safety
 * The type safety is enforced through the ModelDelegate parameter
 */
export default class FlareBuilder<T extends ModelName, Args extends Record<string, any> = Record<string, never>> {
  protected model: ModelDelegate<T>;
  protected query: QueryArgs;

  constructor(model: ModelDelegate<T>, query: QueryArgs = {}) {
    this.model = model;
    this.query = query;
  }

  /**
   * Adds a where condition to the query with type safety from Prisma
   * @param condition - Where filter matching your Prisma model
   */
  where(condition: WhereInput<T>): FlareBuilder<T, Args & { where: WhereInput<T> }> {
    this.query.where = { ...this.query.where, ...(condition as any) };
    return this as any;
  }

  /**
   * Adds a where condition to the query for the specified id
   * @param id - The id to search for
   */
  withId(id: number | string): FlareBuilder<T, Args & { where: { id: number | string } }> {
    if (!id) {
      throw new Error('Id is required');
    }
    this.query.where = { ...this.query.where, id };
    return this as any;
  }

  /**
   * Adds an order by condition to the query
   * @param orderBy - OrderBy object matching your Prisma model
   */
  order(orderBy: OrderByInput<T>): FlareBuilder<T, Args & { orderBy: OrderByInput<T> }> {
    this.query.orderBy = orderBy;
    return this as any;
  }

  /**
   * Gets the last record sorted by the specified field
   * @param key - Field to sort by (defaults to 'createdAt')
   */
  last(key: keyof RecordType<T> | string = 'createdAt'): FlareBuilder<T, Args & { orderBy: any; take: number }> {
    return this.order({ [key as string]: 'desc' } as any).limit(1) as any;
  }

  /**
   * Gets the first record sorted by the specified field
   * @param key - Field to sort by (defaults to 'createdAt')
   */
  first(key: keyof RecordType<T> | string = 'createdAt'): FlareBuilder<T, Args & { orderBy: any; take: number }> {
    return this.order({ [key as string]: 'asc' } as any).limit(1) as any;
  }

  /**
   * Sets a limit on the number of records to retrieve
   * @param limit - Maximum number of records
   */
  limit(limit: number): FlareBuilder<T, Args & { take: number }> {
    this.query.take = limit;
    return this as any;
  }

  /**
   * Sets distinct fields for the query
   * @param distinct - Fields to be distinct
   */
  distinct(distinct: DistinctInput<T>): FlareBuilder<T, Args & { distinct: DistinctInput<T> }> {
    this.query.distinct = distinct;
    return this as any;
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
    this.query.select = { [field]: true };
    const result = await (this.model as any).findFirst(this.query);

    if (!result) {
      return null;
    }

    return result[field] as RecordType<T>[K];
  }

  /**
   * Includes related models in the query
   * @param relations - Include object matching your Prisma model
   */
  include<I extends IncludeInput<T>>(relations: I): FlareBuilder<T, Args & { include: I }> {
    this.query.include = relations;
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
  skip(offset: number): FlareBuilder<T, Args & { skip: number }> {
    this.query.skip = offset;
    return this as any;
  }

  /**
   * Checks if any record exists matching the current query
   * @param existenceKey - Key to check for existence (defaults to 'id')
   */
  async exists(existenceKey = 'id'): Promise<boolean> {
    const result = await (this.model as any).findFirst({
      where: this.query.where,
      select: { [existenceKey]: true },
    });
    return Boolean(result);
  }

  /**
   * Paginates the results
   * @param page - Page number (1-based)
   * @param perPage - Number of records per page
   */
  async paginate(page: number = 1, perPage: number = 15): Promise<PaginatedResult<RecordType<T>>> {
    const skip = (page - 1) * perPage;
    const take = perPage;

    this.query.skip = skip;
    this.query.take = take;

    const [data, total] = await Promise.all([
      (this.model as any).findMany(this.query),
      (this.model as any).count({ where: this.query.where }),
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
    callback: (results: RecordType<T>[]) => Promise<void> | void
  ): Promise<void> {
    let page = 1;
    let hasMore = true;

    const originalSkip = this.query.skip;
    const originalTake = this.query.take;

    while (hasMore) {
      this.query.skip = (page - 1) * size;
      this.query.take = size;

      const results = await (this.model as any).findMany(this.query);

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

    this.query.skip = originalSkip;
    this.query.take = originalTake;
  }

  /**
   * Clones the current query builder instance
   */
  clone(): FlareBuilder<T, Args> {
    const queryCopy = JSON.parse(JSON.stringify(this.query));
    return new FlareBuilder<T, Args>(this.model, queryCopy);
  }

  /** Executes findFirstOrThrow and returns a single record */
  async findFirstOrThrow(): Promise<NonNullable<RecordType<T>>> {
    return (this.model as any).findFirstOrThrow(this.query);
  }

  /** Executes findUniqueOrThrow and returns a single record */
  async findUniqueOrThrow(): Promise<NonNullable<RecordType<T>>> {
    return (this.model as any).findUniqueOrThrow(this.query);
  }

  /** Executes findMany and returns an array of records */
  async findMany(): Promise<Prisma.Result<ModelDelegate<T>, Args, 'findMany'>> {
    return (this.model as any).findMany(this.query);
  }

  /** Executes findFirst and returns a single record or null */
  async findFirst(): Promise<Prisma.Result<ModelDelegate<T>, Args, 'findFirst'>> {
    return (this.model as any).findFirst(this.query);
  }

  /** Executes findUnique and returns a single record or null */
  async findUnique(): Promise<Prisma.Result<ModelDelegate<T>, Args, 'findUnique'>> {
    return (this.model as any).findUnique(this.query);
  }

  /** Executes create and returns the created record */
  async create(data: CreateData<T>): Promise<Prisma.Result<ModelDelegate<T>, Args, 'create'>> {
    const query = { ...this.query, data };
    return (this.model as any).create(query);
  }

  /** Executes createMany and returns the count of created records */
  async createMany(data: CreateManyData<T>): Promise<Prisma.Result<ModelDelegate<T>, Args, 'createMany'>> {
    const query = { ...this.query, data };
    return (this.model as any).createMany(query);
  }

  /** Executes delete and returns the deleted record */
  async delete(args?: DeleteArgs<T>): Promise<Prisma.Result<ModelDelegate<T>, Args, 'delete'>> {
    const query = args ? { ...this.query, ...args } : this.query;
    return (this.model as any).delete(query);
  }

  /** Executes deleteMany and returns the count of deleted records */
  async deleteMany(args?: DeleteManyArgs<T>): Promise<Prisma.Result<ModelDelegate<T>, Args, 'deleteMany'>> {
    const query = args ? { ...this.query, ...args } : this.query;
    return (this.model as any).deleteMany(query);
  }

  /** Executes update and returns the updated record */
  async update(data: UpdateData<T>): Promise<Prisma.Result<ModelDelegate<T>, Args, 'update'>> {
    const query = { ...this.query, data };
    return (this.model as any).update(query);
  }

  /** Executes updateMany and returns the count of updated records */
  async updateMany(data: UpdateManyData<T>): Promise<Prisma.Result<ModelDelegate<T>, Args, 'updateMany'>> {
    const query = { ...this.query, data };
    return (this.model as any).updateMany(query);
  }

  /** Executes upsert and returns the upserted record */
  async upsert(args?: UpsertArgs<T>): Promise<Prisma.Result<ModelDelegate<T>, Args, 'upsert'>> {
    const query = args ? { ...this.query, ...args } : this.query;
    return (this.model as any).upsert(query);
  }

  /**
   * Counts the number of records matching the query
   */
  async count(): Promise<number> {
    return (this.model as any).count(this.query);
  }

  /**
   * Sums the specified numeric field
   * @param field - Field name to sum
   */
  async sum(field: SumFields<T> & string): Promise<number | null> {
    const result = await (this.model as any).aggregate({
      _sum: { [field]: true },
      where: this.query.where,
    });
    return result._sum[field];
  }

  /**
   * Calculates the average of the specified numeric field
   * @param field - Field name to average
   */
  async avg(field: AvgFields<T> & string): Promise<number | null> {
    const result = await (this.model as any).aggregate({
      _avg: { [field]: true },
      where: this.query.where,
    });
    return result._avg[field];
  }

  /**
   * Finds the minimum value of the specified field
   * @param field - Field name to find minimum
   */
  async min(field: MinFields<T> & string): Promise<any> {
    const result = await (this.model as any).aggregate({
      _min: { [field]: true },
      where: this.query.where,
    });
    return result._min[field];
  }

  /**
   * Finds the maximum value of the specified field
   * @param field - Field name to find maximum
   */
  async max(field: MaxFields<T> & string): Promise<any> {
    const result = await (this.model as any).aggregate({
      _max: { [field]: true },
      where: this.query.where,
    });
    return result._max[field];
  }

  /**
   * Plucks the specified field from all results
   * @param field - Field name to pluck
   */
  async pluck<K extends keyof RecordType<T>>(field: K): Promise<RecordType<T>[K][]> {
    this.query.select = { [field]: true };
    const results = await (this.model as any).findMany(this.query);
    return results.map((result: any) => result[field]);
  }
}
