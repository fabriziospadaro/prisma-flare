import hookRegistry from './hookRegistry';
import { Prisma, PrismaClient } from '@prisma/client';
import type { ModelName, PrismaMiddlewareParams } from '../types';
import fs from 'fs';
import path from 'path';

/**
 * Loads callback files from a specified directory.
 * Users can create a 'callbacks' directory in their project and call this function.
 * @param callbacksDir - Path to the callbacks directory
 */
export function loadCallbacks(callbacksDir?: string): void {
  if (!callbacksDir) {
    // Default: try to load from callbacks directory relative to where this is called
    callbacksDir = path.join(process.cwd(), 'prisma', 'callbacks');
  }

  // Check if directory exists
  if (!fs.existsSync(callbacksDir)) {
    console.warn(`Callbacks directory not found: ${callbacksDir}`);
    return;
  }

  fs.readdirSync(callbacksDir).forEach(async file => {
    if (file.endsWith('.js') || file.endsWith('.ts')) {
      const filePath = path.join(callbacksDir, file);
      await import(filePath);
    }
  });
}

async function fetchAffectedRecords(
  db: PrismaClient,
  model: ModelName,
  where: any,
  fields?: Record<string, true>
): Promise<any[]> {
  const key = (model.charAt(0).toLowerCase() + model.slice(1)) as keyof PrismaClient;
  const delegate = db[key] as any;
  // Ensure ID is always selected for tracking
  const select = fields ? { ...fields, id: true } : undefined;
  const records = await delegate.findMany({
    where,
    ...(select && { select }),
  });
  return records;
}

/**
 * Core hook execution logic shared between Prisma 6 ($use) and Prisma 7 (extensions)
 */
async function executeHookLogic(
  prisma: PrismaClient,
  model: string | undefined,
  action: string,
  args: any,
  next: () => Promise<any>
): Promise<any> {
  if (!model) {
    return next();
  }

  // Prisma gives us "User" but we need "user" for the lowercase key
  const modelName = model.toLowerCase() as ModelName;
  const hasColumnHooks = hookRegistry.hasColumnHooks(modelName);

  let prevData: any[] = [];
  let fields: Record<string, true> | undefined;

  if (hasColumnHooks && (action === 'update' || action === 'updateMany')) {
    fields = hookRegistry.getRelevantFields(modelName);
    prevData = await fetchAffectedRecords(prisma, modelName, args.where, fields);
  }

  // Run before hooks (blocking, can throw)
  await hookRegistry.runHooks('before', modelName, action as any, [args], prisma);

  const result = await next();

  if (hasColumnHooks && (action === 'update' || action === 'updateMany')) {
    let newData: any[] = [];

    if (action === 'update') {
      newData = [result];
    } else {
      // Use IDs from prevData to ensure we find the same records even if filter fields changed
      const ids = prevData.map(r => r.id);
      if (ids.length > 0) {
        newData = await fetchAffectedRecords(prisma, modelName, { id: { in: ids } });
      }
    }

    for (let i = 0; i < prevData.length; i++) {
      const prevRecord = prevData[i];
      const newRecord = newData.find(record => record.id === prevRecord.id);

      if (newRecord) {
        hookRegistry.runColumnHooks(modelName, newRecord, prevRecord, prisma).catch(error => {
          console.error('Column hook error:', error);
        });
      }
    }
  }

  hookRegistry.runHooks('after', modelName, action as any, [args, result], prisma).catch(error => {
    console.error('After hook error:', error);
  });

  return result;
}

/**
 * Checks if the Prisma client supports the legacy $use middleware API (Prisma ≤6)
 */
function supportsPrisma6Middleware(prisma: PrismaClient): boolean {
  return typeof (prisma as any).$use === 'function';
}

/**
 * Creates a Prisma 7+ client extension for hooks
 */
export function createHooksExtension(basePrisma: PrismaClient) {
  return Prisma.defineExtension({
    name: 'prisma-flare-hooks',
    query: {
      $allModels: {
        async $allOperations({ model, operation, args, query }) {
          return executeHookLogic(
            basePrisma,
            model,
            operation,
            args,
            () => query(args)
          );
        },
      },
    },
  });
}

/**
 * Registers hooks using the legacy $use middleware API (Prisma ≤6)
 * @deprecated Use createHooksExtension for Prisma 7+
 */
export function registerHooksLegacy(prisma: PrismaClient): void {
  (prisma as any).$use(async (params: any, next: (params: any) => Promise<any>) => {
    const { model, action, args } = params as PrismaMiddlewareParams;
    return executeHookLogic(prisma, model, action, args, () => next(params));
  });
}

/**
 * Registers hooks on the Prisma client.
 * Automatically detects Prisma version and uses the appropriate API:
 * - Prisma ≤6: Uses $use middleware
 * - Prisma 7+: Returns extended client with hooks extension
 * 
 * @param prisma - The Prisma client instance
 * @returns The Prisma client (possibly extended for Prisma 7+)
 */
export function registerHooks<T extends PrismaClient>(prisma: T): T {
  if (supportsPrisma6Middleware(prisma)) {
    // Prisma 6 and below: use legacy $use middleware
    registerHooksLegacy(prisma);
    return prisma;
  } else {
    // Prisma 7+: use client extensions
    const extension = createHooksExtension(prisma);
    return (prisma as any).$extends(extension) as T;
  }
}
