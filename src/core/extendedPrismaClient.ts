import { PrismaClient, Prisma } from '@prisma/client';
import FlareBuilder from './flareBuilder';
import type { ModelName, ModelDelegate } from '../types';

export class ExtendedPrismaClient extends PrismaClient {
  constructor() {
    super();
  }

  /**
   * Creates a new FlareBuilder instance for the specified model.
   * @param modelName - The name of the model.
   * @returns FlareBuilder instance
   */
  from<T extends ModelName>(modelName: T): FlareBuilder<T> {
    const key = (modelName.charAt(0).toLowerCase() + modelName.slice(1)) as keyof PrismaClient;
    const model = this[key] as unknown as ModelDelegate<T>;
    if (!model) {
      throw new Error(`Model ${modelName} does not exist on PrismaClient.`);
    }
    return new FlareBuilder<T>(model);
  }

  /**
   * Executes a transaction with the ExtendedPrismaClient capabilities.
   * @param fn - The transaction function.
   * @param options - Transaction options.
   * @returns The result of the transaction.
   */
  async transaction<R>(
    fn: (tx: ExtendedPrismaClient) => Promise<R>,
    options?: { maxWait?: number; timeout?: number; isolationLevel?: Prisma.TransactionIsolationLevel }
  ): Promise<R> {
    return super.$transaction(async (tx) => {
      const extendedTx = new Proxy(tx, {
        get: (target, prop, receiver) => {
          if (prop === 'from') {
            return <T extends ModelName>(modelName: T) => {
              const key = (modelName.charAt(0).toLowerCase() + modelName.slice(1)) as keyof typeof target;
              const model = target[key] as unknown as ModelDelegate<T>;
              if (!model) {
                throw new Error(`Model ${modelName} does not exist on TransactionClient.`);
              }
              return new FlareBuilder<T>(model);
            };
          }
          return Reflect.get(target, prop, receiver);
        }
      });

      return fn(extendedTx as unknown as ExtendedPrismaClient);
    }, options);
  }
}
