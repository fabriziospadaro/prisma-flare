import type { ModelName } from '../types';
import FlareBuilder from './flareBuilder';

type ModelClass<T extends ModelName = any> = new () => FlareBuilder<T, any>;

/**
 * Registry for custom model classes that extend FlareBuilder.
 * This allows the include() method to instantiate the correct custom model class
 * for related models, preserving custom methods like `.valid()`, `.published()`, etc.
 */
class ModelRegistry {
  private models: Map<string, ModelClass> = new Map();

  /**
   * Register a custom model class for a given model name.
   * The model name should match the Prisma model name (e.g., 'user', 'post', 'enrollment')
   * @param modelName - The lowercase model name (matching Prisma delegate name)
   * @param modelClass - The custom class that extends FlareBuilder
   */
  register<T extends ModelName>(modelName: T, modelClass: ModelClass<T>): void {
    this.models.set(modelName.toLowerCase(), modelClass);
  }

  /**
   * Register multiple models at once
   * @param models - Object mapping model names to their classes
   */
  registerMany(models: Record<string, ModelClass>): void {
    for (const [name, modelClass] of Object.entries(models)) {
      this.register(name as ModelName, modelClass);
    }
  }

  /**
   * Get a custom model class by name
   * @param modelName - The model name to look up
   * @returns The model class or undefined if not registered
   */
  get<T extends ModelName>(modelName: string): ModelClass<T> | undefined {
    return this.models.get(modelName.toLowerCase());
  }

  /**
   * Check if a model is registered
   * @param modelName - The model name to check
   */
  has(modelName: string): boolean {
    return this.models.has(modelName.toLowerCase());
  }

  /**
   * Create an instance of a registered model
   * @param modelName - The model name to instantiate
   * @returns A new instance of the custom model class, or undefined if not registered
   */
  create<T extends ModelName>(modelName: string): FlareBuilder<T, any> | undefined {
    const ModelClass = this.get<T>(modelName);
    if (ModelClass) {
      return new ModelClass();
    }
    return undefined;
  }

  /**
   * Clear all registered models (useful for testing)
   */
  clear(): void {
    this.models.clear();
  }

  /**
   * Get all registered model names
   */
  getRegisteredModels(): string[] {
    return Array.from(this.models.keys());
  }
}

// Use a global symbol to ensure there's only ONE modelRegistry instance
// even when the module is loaded from different paths or through ESM/CJS interop
const MODEL_REGISTRY_SYMBOL = Symbol.for('prisma-flare.modelRegistry');

const globalObj = globalThis as Record<symbol, ModelRegistry>;
if (!globalObj[MODEL_REGISTRY_SYMBOL]) {
  globalObj[MODEL_REGISTRY_SYMBOL] = new ModelRegistry();
}

export const modelRegistry = globalObj[MODEL_REGISTRY_SYMBOL];
export default modelRegistry;
