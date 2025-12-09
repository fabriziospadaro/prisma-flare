import hookRegistry from './hookRegistry';
import type { PrismaClient } from '@prisma/client';
import type { ModelName } from '../types';
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
  const delegate = db[model] as any;
  // Ensure ID is always selected for tracking
  const select = fields ? { ...fields, id: true } : undefined;
  const records = await delegate.findMany({
    where,
    ...(select && { select }),
  });
  return records;
}

export function addMiddleware(prisma: PrismaClient): void {
  prisma.$use(async (params, next) => {
    const { model, action, args } = params;

    if (!model) {
      return next(params);
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

    const result = await next(params);

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
  });
}
