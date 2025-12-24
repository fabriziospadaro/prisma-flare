import hookRegistry from './hookRegistry';
import { Prisma, PrismaClient } from '@prisma/client';
import type { ModelName, PrismaMiddlewareParams } from '../types';
import fs from 'fs';
import path from 'path';

/**
 * Checks if the current runtime supports TypeScript imports natively.
 * Returns true if running under ts-node, tsx, or Bun.
 */
function supportsTypeScriptImports(): boolean {
  // Check for ts-node
  if (process.env.TS_NODE || (Symbol.for('ts-node.register.instance') in process)) {
    return true;
  }
  // Check for tsx
  if (process.env.TSX) {
    return true;
  }
  // Check for Bun
  if (typeof (globalThis as any).Bun !== 'undefined') {
    return true;
  }
  // Check for Vitest
  if (process.env.VITEST) {
    return true;
  }
  return false;
}

/**
 * Loads callback files from a specified directory.
 * Users can create a 'callbacks' directory in their project and call this function.
 * 
 * IMPORTANT: This function is async - you MUST await it before querying to ensure
 * all hooks are registered.
 * 
 * In production Node.js environments, only .js files are loaded.
 * TypeScript files (.ts) are only loaded when running under ts-node, tsx, Bun, or Vitest.
 * Make sure to compile your TypeScript callbacks to JavaScript for production.
 * 
 * @param callbacksDir - Path to the callbacks directory
 * @returns Promise that resolves when all callbacks are loaded
 * 
 * @example
 * // In your app initialization:
 * await loadCallbacks();
 * // Now safe to query - all hooks are registered
 */
export async function loadCallbacks(callbacksDir?: string): Promise<void> {
  if (!callbacksDir) {
    // Default: try to load from callbacks directory relative to where this is called
    callbacksDir = path.join(process.cwd(), 'prisma', 'callbacks');
  }

  // Check if directory exists
  if (!fs.existsSync(callbacksDir)) {
    console.warn(`Callbacks directory not found: ${callbacksDir}`);
    return;
  }

  const canImportTs = supportsTypeScriptImports();
  const files = fs.readdirSync(callbacksDir);

  // Properly await all imports sequentially to ensure deterministic load order
  for (const file of files) {
    const filePath = path.join(callbacksDir, file);

    if (file.endsWith('.js')) {
      await import(filePath);
    } else if (file.endsWith('.ts') && canImportTs) {
      await import(filePath);
    } else if (file.endsWith('.ts') && !canImportTs) {
      console.warn(
        `Skipping TypeScript callback file: ${file}. ` +
        `TypeScript imports require ts-node, tsx, or Bun. ` +
        `Compile to JavaScript for production use.`
      );
    }
  }
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

  // Strip __flare meta key before passing to Prisma (used for per-call hook config)
  // Check both args level (for operations like create) and args.data level (for update)
  let flareOptions = args?.__flare;
  if (args?.__flare) {
    delete args.__flare;
  }
  // Also check inside data for update operations
  if (args?.data?.__flare) {
    flareOptions = args.data.__flare;
    delete args.data.__flare;
  }

  // Prisma gives us "User" but we need "user" for the lowercase key
  const modelName = model.toLowerCase() as ModelName;
  const hasColumnHooks = hookRegistry.hasColumnHooks(modelName);

  let prevData: any[] = [];
  let fields: Record<string, true> | undefined;
  let shouldRunColumnHooks = false;

  // Check if we should run column hooks (respects config + limits + per-call options)
  const isUpdateAction = action === 'update' || action === 'updateMany';

  if (hasColumnHooks && isUpdateAction) {
    fields = hookRegistry.getRelevantFields(modelName);
    prevData = await fetchAffectedRecords(prisma, model as ModelName, args.where, fields);

    // Check config, record count limits, and per-call skip option
    shouldRunColumnHooks = hookRegistry.shouldRunColumnHooks(modelName, prevData.length, { __flare: flareOptions });
  }

  // Run before hooks (blocking, can throw)
  await hookRegistry.runHooks('before', modelName, action as any, [args], prisma);

  const result = await next();

  if (shouldRunColumnHooks && prevData.length > 0) {
    let newData: any[] = [];

    // Always re-fetch updated records to ensure we have all relevant fields
    // This fixes the issue where update() with select/include returns only partial data,
    // causing afterChange hooks to miss column changes not in the returned result
    const ids = prevData.map(r => r.id);
    newData = await fetchAffectedRecords(prisma, model as ModelName, { id: { in: ids } }, fields);

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
 * @deprecated Use `new FlareClient()` instead. FlareClient now automatically
 * attaches the callbacks middleware. This function will be removed in a future version.
 *
 * @example
 * // Old way (deprecated):
 * import './callbacks';
 * import { FlareClient, registerHooks } from 'prisma-flare';
 * export const db = registerHooks(new FlareClient());
 *
 * // New way:
 * import './callbacks';
 * import { FlareClient } from 'prisma-flare';
 * export const db = new FlareClient();
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
