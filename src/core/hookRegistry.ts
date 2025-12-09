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
    afterChange: Record<string, ColumnChangeCallback[]>;
  };
  
  private fieldCache: Record<string, Record<string, true>>;

  constructor() {
    this.hooks = {
      before: {},
      after: {},
    };
    this.columnHooks = {
      afterChange: {},
    };
    this.fieldCache = {};
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

  addColumnHook(model: ModelName, column: string, fn: ColumnChangeCallback): void {
    const key = `${model}:${column}`;
    if (!this.columnHooks.afterChange[key]) {
      this.columnHooks.afterChange[key] = [];
    }
    this.columnHooks.afterChange[key].push(fn);
  }

  async runHooks(
    timing: HookTiming, 
    model: ModelName, 
    action: PrismaOperation, 
    args: any[],
  ): Promise<void> {
    const key = `${model}:${action}`;
    const hooks = this.hooks[timing]?.[key] ?? [];
    
    for (const hook of hooks) {
      await (hook as any)(...args);
    }
  }

  async runColumnHooks(model: ModelName, newData: any, prevData: any): Promise<void> {
    for (const column in newData) {
      const key = `${model}:${column}`;
      const hooks = this.columnHooks.afterChange[key];
      
      if (hooks && newData[column] !== prevData[column]) {
        for (const hook of hooks) {
          await hook(prevData[column], newData[column], newData);
        }
      }
    }
  }

  hasColumnHooks(model: ModelName): boolean {
    return Object.keys(this.columnHooks.afterChange).some(key => 
      key.startsWith(`${model}:`)
    );
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
  }
}

const hookRegistry = new HookRegistry();
export default hookRegistry;
