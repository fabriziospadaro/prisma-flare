import type {
  HookTiming,
  PrismaOperation,
  BeforeHookCallback,
  AfterHookCallback,
  ColumnChangeCallback,
  ModelName
} from '../types';

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

      if (hooks && newData[column] !== prevData[column]) {
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
  }
}

const hookRegistry = new HookRegistry();
export default hookRegistry;
