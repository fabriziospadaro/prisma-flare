import type {
  HookTiming,
  PrismaOperation,
  BeforeHookCallback,
  AfterHookCallback,
  ColumnChangeCallback,
  ModelName
} from '../types';

/**
 * Compares two values for equality, with special handling for:
 * - Date: compares by timestamp (.getTime())
 * - Decimal: compares by string representation (.toString())
 * - Objects/Arrays (JSON fields): compares by JSON.stringify
 * - Primitives: uses strict equality
 * 
 * This prevents false positives/negatives in column change detection.
 */
function valuesEqual(a: unknown, b: unknown): boolean {
  // Both null/undefined
  if (a == null && b == null) return true;
  if (a == null || b == null) return false;

  // Same reference
  if (a === b) return true;

  // Date comparison
  if (a instanceof Date && b instanceof Date) {
    return a.getTime() === b.getTime();
  }

  // Prisma Decimal comparison (has toDecimalPlaces/toString)
  if (typeof (a as any).toDecimalPlaces === 'function' &&
    typeof (b as any).toDecimalPlaces === 'function') {
    return (a as any).toString() === (b as any).toString();
  }

  // BigInt comparison
  if (typeof a === 'bigint' && typeof b === 'bigint') {
    return a === b;
  }

  // Object/Array comparison (JSON fields) - use JSON.stringify
  if (typeof a === 'object' && typeof b === 'object') {
    try {
      return JSON.stringify(a) === JSON.stringify(b);
    } catch {
      // If stringify fails, fall back to reference check (already false)
      return false;
    }
  }

  // Primitive comparison
  return a === b;
}

/**
 * Configuration options for the hook system.
 */
export interface HookConfig {
  /**
   * Whether column-level hooks (afterChange) are enabled.
   * Set to false to disable all column hooks globally.
   * @default true
   */
  enableColumnHooks: boolean;

  /**
   * Maximum number of records to re-fetch for column hooks on updateMany.
   * If an updateMany affects more records than this limit, column hooks
   * will be skipped and a warning logged.
   * Set to 0 or Infinity to disable the limit.
   * @default 1000
   */
  maxRefetch: number;

  /**
   * Whether to log warnings when hooks are skipped.
   * @default true
   */
  warnOnSkip: boolean;
}

const DEFAULT_CONFIG: HookConfig = {
  enableColumnHooks: true,
  maxRefetch: 1000,
  warnOnSkip: true,
};

class HookRegistry {
  private hooks: {
    before: Record<string, BeforeHookCallback[]>;
    after: Record<string, AfterHookCallback[]>;
  };

  private columnHooks: {
    afterChange: Record<string, ColumnChangeCallback<any>[]>;
  };

  private fieldCache: Record<string, Record<string, true>>;
  private modelsWithColumnHooks: Set<string>;
  private config: HookConfig;

  constructor() {
    this.hooks = {
      before: {},
      after: {},
    };
    this.columnHooks = {
      afterChange: {},
    };
    this.fieldCache = {};
    this.modelsWithColumnHooks = new Set();
    this.config = { ...DEFAULT_CONFIG };
  }

  /**
   * Configure the hook system.
   * @param config - Partial configuration to merge with defaults
   * 
   * @example
   * // Disable column hooks globally for performance
   * hookRegistry.configure({ enableColumnHooks: false });
   * 
   * @example
   * // Increase maxRefetch limit
   * hookRegistry.configure({ maxRefetch: 5000 });
   * 
   * @example
   * // Disable limit entirely (use with caution)
   * hookRegistry.configure({ maxRefetch: Infinity });
   */
  configure(config: Partial<HookConfig>): void {
    this.config = { ...this.config, ...config };
  }

  /**
   * Get current configuration.
   */
  getConfig(): Readonly<HookConfig> {
    return this.config;
  }

  addHook(
    model: ModelName,
    action: PrismaOperation,
    timing: HookTiming,
    fn: BeforeHookCallback | AfterHookCallback
  ): void {
    const key = `${model}:${action}`;
    if (!this.hooks[timing][key]) {
      this.hooks[timing][key] = [];
    }
    this.hooks[timing][key].push(fn as any);
  }

  addColumnHook(model: ModelName, column: string, fn: ColumnChangeCallback<any>): void {
    const key = `${model}:${column}`;
    if (!this.columnHooks.afterChange[key]) {
      this.columnHooks.afterChange[key] = [];
    }
    this.columnHooks.afterChange[key].push(fn);
    this.modelsWithColumnHooks.add(model);
  }

  async runHooks(
    timing: HookTiming,
    model: ModelName,
    action: PrismaOperation,
    args: any[],
    prisma: any
  ): Promise<void> {
    const key = `${model}:${action}`;
    const hooks = this.hooks[timing]?.[key] ?? [];

    if (timing === 'after') {
      await Promise.all(hooks.map(hook => (hook as any)(...args, prisma)));
    } else {
      for (const hook of hooks) {
        await (hook as any)(...args, prisma);
      }
    }
  }

  async runColumnHooks(model: ModelName, newData: any, prevData: any, prisma: any): Promise<void> {
    const promises: Promise<void>[] = [];
    for (const column in newData) {
      const key = `${model}:${column}`;
      const hooks = this.columnHooks.afterChange[key];

      if (hooks && !valuesEqual(newData[column], prevData[column])) {
        for (const hook of hooks) {
          promises.push(hook(prevData[column], newData[column], newData, prisma) as Promise<void>);
        }
      }
    }
    await Promise.all(promises);
  }

  hasColumnHooks(model: ModelName): boolean {
    return this.modelsWithColumnHooks.has(model);
  }

  /**
   * Check if column hooks should run for an operation.
   * Takes into account global config, record count limits, and per-call options.
   * 
   * @param model - The model name
   * @param recordCount - Number of records affected (for maxRefetch check)
   * @param args - The operation args (to check for __flare skip option)
   * @returns Whether column hooks should execute
   */
  shouldRunColumnHooks(model: ModelName, recordCount: number, args?: any): boolean {
    // Check per-call skip option
    if (args?.__flare?.skipColumnHooks === true) {
      return false;
    }

    if (!this.config.enableColumnHooks) {
      return false;
    }

    if (!this.modelsWithColumnHooks.has(model)) {
      return false;
    }

    if (this.config.maxRefetch > 0 && recordCount > this.config.maxRefetch) {
      if (this.config.warnOnSkip) {
        console.warn(
          `[prisma-flare] Skipping column hooks for ${model}: ` +
          `${recordCount} records exceeds maxRefetch limit of ${this.config.maxRefetch}. ` +
          `Configure via hookRegistry.configure({ maxRefetch: ... })`
        );
      }
      return false;
    }

    return true;
  }

  getRelevantFields(model: ModelName): Record<string, true> {
    if (this.fieldCache[model]) {
      return this.fieldCache[model];
    }

    const fields = new Set<string>();

    for (const key of Object.keys(this.columnHooks.afterChange)) {
      if (key.startsWith(`${model}:`)) {
        const [, column] = key.split(':');
        fields.add(column);
      }
    }

    fields.add('id'); // Ensure the ID field is always included for comparison

    const result = Array.from(fields).reduce((acc, field) => {
      acc[field] = true;
      return acc;
    }, {} as Record<string, true>);

    this.fieldCache[model] = result;
    return result;
  }

  /**
   * Clear all registered hooks (useful for testing)
   */
  clearAll(): void {
    this.hooks.before = {};
    this.hooks.after = {};
    this.columnHooks.afterChange = {};
    this.fieldCache = {};
    this.modelsWithColumnHooks.clear();
    this.config = { ...DEFAULT_CONFIG };
  }
}

const hookRegistry = new HookRegistry();
export default hookRegistry;
