import { Prisma } from '@prisma/client';
import type { ModelName, ModelDelegate, RecordType, FindManyArgs, PrismaArgs } from '../types';

type QueryArgs = Record<string, any>;

type WhereInput<T extends ModelName> = FindManyArgs<T> extends { where?: infer W } ? W : never;
type OrderByInput<T extends ModelName> = FindManyArgs<T> extends { orderBy?: infer O } ? O : never;
type SelectInput<T extends ModelName> = FindManyArgs<T> extends { select?: infer S } ? S : never;
type IncludeInput<T extends ModelName> = FindManyArgs<T> extends { include?: infer I } ? I : never;
type DistinctInput<T extends ModelName> = FindManyArgs<T> extends { distinct?: infer D } ? D : never;

type CreateArgs<T extends ModelName> = PrismaArgs<T, 'create'>;
type CreateManyArgs<T extends ModelName> = PrismaArgs<T, 'createMany'>;
type UpdateArgs<T extends ModelName> = PrismaArgs<T, 'update'>;
type UpdateManyArgs<T extends ModelName> = PrismaArgs<T, 'updateMany'>;
type DeleteArgs<T extends ModelName> = PrismaArgs<T, 'delete'>;
type DeleteManyArgs<T extends ModelName> = PrismaArgs<T, 'deleteMany'>;
type UpsertArgs<T extends ModelName> = PrismaArgs<T, 'upsert'>;

type GroupByArgs<T extends ModelName> = PrismaArgs<T, 'groupBy'>;
type GroupByInput<T extends ModelName> = GroupByArgs<T> extends { by: infer B } ? B : never;
type HavingInput<T extends ModelName> = GroupByArgs<T> extends { having?: infer H } ? H : never;

type AggregateArgs<T extends ModelName> = PrismaArgs<T, 'aggregate'>;
type SumFields<T extends ModelName> = AggregateArgs<T> extends { _sum?: infer S } ? keyof S : string;
type AvgFields<T extends ModelName> = AggregateArgs<T> extends { _avg?: infer A } ? keyof A : string;
type MinFields<T extends ModelName> = AggregateArgs<T> extends { _min?: infer M } ? keyof M : string;
type MaxFields<T extends ModelName> = AggregateArgs<T> extends { _max?: infer M } ? keyof M : string;

/**
 * QueryBuilder for chainable Prisma queries with full type safety
 * The type safety is enforced through the ModelDelegate parameter
 */
export default class QueryBuilder<T extends ModelName, Args extends Record<string, any> = {}> {
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
  where(condition: WhereInput<T>): QueryBuilder<T, Args & { where: WhereInput<T> }> {
    this.query.where = { ...this.query.where, ...(condition as any) };
    return this as any;
  }

  /**
   * Adds a where condition to the query for the specified id
   * @param id - The id to search for
   */
  whereId(id: number | string): QueryBuilder<T, Args & { where: { id: number | string } }> {
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
  order(orderBy: OrderByInput<T>): QueryBuilder<T, Args & { orderBy: OrderByInput<T> }> {
    this.query.orderBy = orderBy;
    return this as any;
  }

  /**
   * Gets the last record sorted by the specified field
   * @param key - Field to sort by (defaults to 'createdAt')
   */
  last(key: keyof RecordType<T> | string = 'createdAt'): QueryBuilder<T, Args & { orderBy: any; take: number }> {
    return this.order({ [key as string]: 'desc' } as any).limit(1) as any;
  }

  /**
   * Gets the first record sorted by the specified field
   * @param key - Field to sort by (defaults to 'createdAt')
   */
  first(key: keyof RecordType<T> | string = 'createdAt'): QueryBuilder<T, Args & { orderBy: any; take: number }> {
    return this.order({ [key as string]: 'asc' } as any).limit(1) as any;
  }

  /**
   * Sets a limit on the number of records to retrieve
   * @param limit - Maximum number of records
   */
  limit(limit: number): QueryBuilder<T, Args & { take: number }> {
    this.query.take = limit;
    return this as any;
  }

  /**
   * Sets distinct fields for the query
   * @param distinct - Fields to be distinct
   */
  distinct(distinct: DistinctInput<T>): QueryBuilder<T, Args & { distinct: DistinctInput<T> }> {
    this.query.distinct = distinct;
    return this as any;
  }

  /**
   * Selects specific fields to retrieve
   * @param fields - Select object matching your Prisma model
   */
  select<S extends SelectInput<T>>(fields: S): QueryBuilder<T, Args & { select: S }> {
    this.query.select = fields;
    return this as any;
  }

  /**
   * Selects only the specified field and returns its value
   * @param field - Field name to retrieve
   */
  async only<K extends keyof NonNullable<RecordType<T>>>(
    field: K
  ): Promise<NonNullable<RecordType<T>>[K] | null> {
    this.query.select = { [field]: true };
    const result = await (this.model as any).findFirst(this.query);

    if (!result) {
      return null;
    }

    return result[field] as NonNullable<RecordType<T>>[K];
  }

  /**
   * Includes related models in the query
   * @param relations - Include object matching your Prisma model
   */
  include<I extends IncludeInput<T>>(relations: I): QueryBuilder<T, Args & { include: I }> {
    this.query.include = relations;
    return this as any;
  }

  /**
   * Groups results by specified fields
   * @param groupBy - Fields to group by
   */
  groupBy(groupBy: GroupByInput<T>): QueryBuilder<T, Args & { by: GroupByInput<T> }> {
    (this.query as any).by = groupBy;
    return this as any;
  }

  /**
   * Adds a having condition to the query
   * @param condition - Having condition
   */
  having(condition: HavingInput<T>): QueryBuilder<T, Args & { having: HavingInput<T> }> {
    this.query.having = condition;
    return this as any;
  }

  /**
   * Skips the specified number of records
   * @param offset - Number of records to skip
   */
  skip(offset: number): QueryBuilder<T, Args & { skip: number }> {
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
   * Executes the query with the specified action
   * @param action - Prisma action to execute
   */
  async run(action: keyof ModelDelegate<T> = 'findMany' as any): Promise<any> {
    return (this.model as any)[action](this.query);
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
  async create(args?: CreateArgs<T>): Promise<Prisma.Result<ModelDelegate<T>, Args, 'create'>> {
    const query = args ? { ...this.query, ...args } : this.query;
    return (this.model as any).create(query);
  }

  /** Executes createMany and returns the count of created records */
  async createMany(args?: CreateManyArgs<T>): Promise<Prisma.Result<ModelDelegate<T>, Args, 'createMany'>> {
    const query = args ? { ...this.query, ...args } : this.query;
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
  async update(args?: UpdateArgs<T>): Promise<Prisma.Result<ModelDelegate<T>, Args, 'update'>> {
    const query = args ? { ...this.query, ...args } : this.query;
    return (this.model as any).update(query);
  }

  /** Executes updateMany and returns the count of updated records */
  async updateMany(args?: UpdateManyArgs<T>): Promise<Prisma.Result<ModelDelegate<T>, Args, 'updateMany'>> {
    const query = args ? { ...this.query, ...args } : this.query;
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
   * Plucks the specified fields from all results
   * @param fields - Select object with fields to pluck
   */
  async pluck(fields: SelectInput<T>): Promise<any[]> {
    this.query.select = fields;
    const results = await (this.model as any).findMany(this.query);

    const fieldKeys = Object.keys(fields as any);
    if (fieldKeys.length === 1) {
      const fieldName = fieldKeys[0];
      return results.map((result: any) => result[fieldName]);
    } else {
      return results.map((result: any) => fieldKeys.map((key) => result[key]));
    }
  }
}
