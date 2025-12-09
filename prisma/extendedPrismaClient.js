const { PrismaClient } = require('@prisma/client');
import QueryBuilder from './queryBuilder.js';

export default class ExtendedPrismaClient extends PrismaClient {
  constructor() {
    super();
    this.query = this.query.bind(this);
  }

  /**
   * Creates a new QueryBuilder instance for the specified model.
   * @template {keyof PrismaClient} T
   * @param {T} modelName - The name of the model.
   * @returns {QueryBuilder<T>}
   */
  query(modelName) {
    const model = this[modelName];
    if (!model) throw new Error(`Model ${modelName} does not exist on PrismaClient.`);
    return new QueryBuilder(model);
  }

}