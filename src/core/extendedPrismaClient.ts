import { PrismaClient } from '@prisma/client';
import type { PrismaClientOptions } from '@prisma/client/runtime/library';
import FlareBuilder from './flareBuilder';
import type { ModelName, ModelDelegate } from '../types';
import { createHooksExtension, registerHooksLegacy } from './hookMiddleware';

export interface FlareClientOptions extends PrismaClientOptions {
  /**
   * Enable callbacks/hooks middleware. When true (default), the middleware
   * that executes your registered callbacks (beforeCreate, afterUpdate, etc.)
   * is automatically attached.
   *
   * @default true
   */
  callbacks?: boolean;
}

/**
 * Checks if the Prisma client supports the legacy $use middleware API (Prisma ≤6)
 */
function supportsPrisma6Middleware(prisma: PrismaClient): boolean {
  return typeof (prisma as any).$use === 'function';
}

export class FlareClient extends PrismaClient {
  constructor(options: FlareClientOptions = {}) {
    const { callbacks = true, ...prismaOptions } = options;
    super(prismaOptions);

    if (callbacks) {
      if (supportsPrisma6Middleware(this)) {
        // Prisma 6 and below: use legacy $use middleware (mutates in place)
        registerHooksLegacy(this);
      } else {
        // Prisma 7+: use client extensions (returns new instance)
        const extension = createHooksExtension(this);
        return (this as any).$extends(extension);
      }
    }
  }

  /**
   * Creates a new FlareBuilder instance for the specified model.
   * @param modelName - The name of the model.
   * @returns FlareBuilder instance
   */
  from<T extends ModelName>(modelName: T): FlareBuilder<T> {
    const key = (modelName.charAt(0).toLowerCase() + modelName.slice(1)) as string;
    const model = (this as any)[key] as unknown as ModelDelegate<T>;
    if (!model) {
      throw new Error(`Model ${modelName} does not exist on PrismaClient.`);
    }
    return new FlareBuilder<T>(model);
  }

  /**
   * Executes a transaction with the FlareClient capabilities.
   * @param fn - The transaction function.
   * @param options - Transaction options.
   * @returns The result of the transaction.
   */
  async transaction<R>(
    fn: (tx: FlareClient) => Promise<R>,
    options?: { maxWait?: number; timeout?: number; isolationLevel?: any }
  ): Promise<R> {
    return super.$transaction(async (tx: any) => {
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

      return fn(extendedTx as unknown as FlareClient);
    }, options);
  }
}

/**
 * @deprecated Use `FlareClient` instead. This alias will be removed in a future version.
 */
export const ExtendedPrismaClient = FlareClient;
