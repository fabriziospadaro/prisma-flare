import type { PrismaClient } from '@prisma/client';
import type { DriverAdapter } from '@prisma/client/runtime/library';
import FlareBuilder from './flareBuilder';
import { createHooksExtension, registerHooksLegacy, setPrismaNamespace } from './hookMiddleware';
import type { ModelName, ModelDelegate } from '../types';

/**
 * Options for FlareClient created via the factory.
 * Extends the standard PrismaClient options.
 */
export interface FactoryFlareClientOptions {
  /**
   * Enable callbacks/hooks middleware. When true (default), the middleware
   * that executes your registered callbacks (beforeCreate, afterUpdate, etc.)
   * is automatically attached.
   *
   * @default true
   */
  callbacks?: boolean;

  /**
   * Driver adapter for serverless/edge environments.
   * Pass an adapter instance (e.g., from @prisma/adapter-pg, @prisma/adapter-d1, etc.)
   */
  adapter?: DriverAdapter;

  /**
   * Any additional PrismaClient options are passed through
   */
  [key: string]: unknown;
}

/**
 * Checks if the Prisma client supports the legacy $use middleware API (Prisma <=6)
 */
function supportsPrisma6Middleware(prisma: PrismaClient): boolean {
  return typeof (prisma as any).$use === 'function';
}

/**
 * Type for the Prisma namespace (contains Result, defineExtension, etc.)
 */
export type PrismaNamespace = {
  defineExtension: (extension: any) => any;
  [key: string]: unknown;
};

/**
 * Type for a PrismaClient-like constructor.
 * Uses `any` for options to accept any PrismaClient variant.
 */
export interface PrismaClientLike {
  new (options?: any): PrismaClient;
}

/**
 * The shape of a FlareClient class created by the factory
 */
export interface FlareClientClass {
  new (options?: FactoryFlareClientOptions): FlareClientInstance;
}

/**
 * Instance type for FlareClient
 */
export interface FlareClientInstance extends PrismaClient {
  /**
   * Creates a new FlareBuilder instance for the specified model.
   * @param modelName - The lowercase model name (e.g., 'user', 'post')
   */
  from<M extends ModelName>(modelName: M): FlareBuilder<M>;
  transaction<R>(
    fn: (tx: FlareClientInstance) => Promise<R>,
    options?: { maxWait?: number; timeout?: number; isolationLevel?: unknown }
  ): Promise<R>;
}

/**
 * Creates a FlareClient class that extends the provided PrismaClient.
 * This is the primary way to use prisma-flare, supporting both default
 * and custom Prisma client output paths.
 *
 * @param BasePrismaClient - The PrismaClient class to extend
 * @param PrismaNamespaceArg - The Prisma namespace (required for hooks/extensions)
 * @returns A FlareClient class that extends BasePrismaClient
 *
 * @example
 * // Using default @prisma/client:
 * import { PrismaClient, Prisma } from '@prisma/client';
 * import { createFlareClient } from 'prisma-flare';
 *
 * const FlareClient = createFlareClient(PrismaClient, Prisma);
 * export const db = new FlareClient();
 *
 * @example
 * // Using custom Prisma output path:
 * import { PrismaClient, Prisma } from './prisma/generated/client';
 * import { createFlareClient } from 'prisma-flare';
 *
 * const FlareClient = createFlareClient(PrismaClient, Prisma);
 * export const db = new FlareClient();
 */
export function createFlareClient(
  BasePrismaClient: PrismaClientLike,
  PrismaNamespaceArg: PrismaNamespace
): FlareClientClass {
  // Set the Prisma namespace for hooks extension
  setPrismaNamespace(PrismaNamespaceArg);

  // Use a class expression that TypeScript can type-check
  const FlareClientImpl = class extends (BasePrismaClient as new (options?: Record<string, unknown>) => PrismaClient) {
    constructor(options: FactoryFlareClientOptions = {}) {
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
    from<M extends ModelName>(modelName: M): FlareBuilder<M> {
      const key = (modelName.charAt(0).toLowerCase() + modelName.slice(1)) as string;
      const model = (this as any)[key] as ModelDelegate<M>;
      if (!model) {
        throw new Error(`Model ${modelName} does not exist on PrismaClient.`);
      }
      return new FlareBuilder<M>(model);
    }

    /**
     * Executes a transaction with the FlareClient capabilities.
     * @param fn - The transaction function.
     * @param options - Transaction options.
     * @returns The result of the transaction.
     */
    async transaction<R>(
      fn: (tx: FlareClientInstance) => Promise<R>,
      options?: { maxWait?: number; timeout?: number; isolationLevel?: unknown }
    ): Promise<R> {
      return (this as any).$transaction(async (tx: any) => {
        const extendedTx = new Proxy(tx, {
          get: (target, prop, receiver) => {
            if (prop === 'from') {
              return <M extends ModelName>(modelName: M) => {
                const key = (modelName.charAt(0).toLowerCase() + modelName.slice(1)) as keyof typeof target;
                const model = target[key] as ModelDelegate<M>;
                if (!model) {
                  throw new Error(`Model ${modelName} does not exist on TransactionClient.`);
                }
                return new FlareBuilder<M>(model);
              };
            }
            return Reflect.get(target, prop, receiver);
          }
        });

        return fn(extendedTx as FlareClientInstance);
      }, options);
    }
  };

  return FlareClientImpl as unknown as FlareClientClass;
}
