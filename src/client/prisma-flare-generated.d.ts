/**
 * Stub type declarations for prisma-flare-generated module.
 * This module is generated at runtime by `prisma-flare generate`.
 * These types provide the shape that the generated module will have.
 */

import type { PrismaClient } from '@prisma/client';
import type { ModelName } from '../types';
import type FlareBuilderType from '../core/flareBuilder';

export interface FlareClientOptions {
  callbacks?: boolean;
  [key: string]: unknown;
}

export declare class FlareClient extends PrismaClient {
  constructor(options?: FlareClientOptions);
  from<M extends ModelName>(modelName: M): FlareBuilderType<M>;
  transaction<R>(
    fn: (tx: FlareClient) => Promise<R>,
    options?: { maxWait?: number; timeout?: number; isolationLevel?: unknown }
  ): Promise<R>;
}

// Re-export FlareBuilder for model class inheritance
export type FlareBuilder<
  T extends ModelName,
  Args extends Record<string, any> = Record<string, never>
> = FlareBuilderType<T, Args>;
export declare const FlareBuilder: typeof FlareBuilderType;

export declare const Prisma: typeof import('@prisma/client').Prisma;
export declare const PrismaClient: typeof import('@prisma/client').PrismaClient;
