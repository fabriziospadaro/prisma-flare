import { PrismaClient } from '@prisma/client';
import QueryBuilder from './queryBuilder';
import type { ModelName, ModelDelegate } from '../types';

export default class ExtendedPrismaClient extends PrismaClient {
  constructor() {
    super();
  }

  /**
   * Creates a new QueryBuilder instance for the specified model.
   * @param modelName - The name of the model.
   * @returns QueryBuilder instance
   */
  query<T extends ModelName>(modelName: T): QueryBuilder<T> {
    const model = this[modelName] as ModelDelegate<T>;
    if (!model) {
      throw new Error(`Model ${modelName} does not exist on PrismaClient.`);
    }
    return new QueryBuilder<T>(model);
  }
}
