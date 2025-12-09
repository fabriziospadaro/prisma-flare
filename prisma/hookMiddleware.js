import hookRegistry from "./hookRegistry.js";

import fs from 'fs';
import path from 'path';

/**
 * Loads callback files from a specified directory.
 * Users can create a 'callbacks' directory in their project and call this function.
 * @param {string} callbacksDir - Path to the callbacks directory
 */
export const loadCallbacks = (callbacksDir) => {
  if (!callbacksDir) {
    // Default: try to load from callbacks directory relative to where this is called
    callbacksDir = path.join(process.cwd(), 'prisma', 'callbacks');
  }
  
  // Check if directory exists
  if (!fs.existsSync(callbacksDir)) {
    console.warn(`Callbacks directory not found: ${callbacksDir}`);
    return;
  }

  fs.readdirSync(callbacksDir).forEach(file => {
    if (file.endsWith('.js')) {
      const filePath = path.join(callbacksDir, file);
      require(filePath);
    }
  });
};

async function fetchAffectedRecords(db, model, where, fields) {
  const records = await db[model].findMany({
    where,
    ...(fields && { select: fields }),
  });
  return records;
}

export const addMiddleware = (prisma) => {
  prisma.$use(async (params, next) => {
    const { model, action, args } = params;

    const hasColumnHooks = hookRegistry.hasColumnHooks(model);

    let prevData = [];
    let fields = []
    if ((hasColumnHooks) && (action === 'update' || action === 'updateMany')) {
      fields = hookRegistry.getRelevantFields(model);
      prevData = await fetchAffectedRecords(prisma, model, args.where, fields);
    }

    try {
      await hookRegistry.runHooks('before', model, action, args);
    } catch (error) {
      console.error(error);
      // sentryClient.captureException(error, {
      //   extra: {
      //     model, action,
      //     args,
      //   }
      // });
    }

    const result = await next(params);

    if ((hasColumnHooks) && (action === 'update' || action === 'updateMany')) {
      let newData = null;
      if (action === 'update')
        newData = [result];
      else
        newData = await fetchAffectedRecords(prisma, model, args.where);

      for (let i = 0; i < prevData.length; i++) {
        const prevRecord = prevData[i];
        const newRecord = newData.find(record => record.id === prevRecord.id);
        if (newRecord) {
          hookRegistry.runColumnHooks(model, newRecord, prevRecord).catch(error => {
            // sentryClient.captureException(error, {
            //   extra: {
            //     model, action,
            //     args, prevRecord,
            //     newRecord,
            //   }
            // });
          });
        }
      }
    }

    hookRegistry.runHooks('after', model, action, args, result).catch(error => {
      // sentryClient.captureException(error, {
      //   extra: {
      //     model, action,
      //     args,
      //     result,
      //   }
      // });
    });

    return result;
  });
}