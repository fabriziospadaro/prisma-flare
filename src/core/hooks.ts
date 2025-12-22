import hookRegistry from './hookRegistry';
import type { 
  ModelName,
  BeforeHookCallback,
  AfterHookCallback,
  ColumnChangeCallback
} from '../types';

function normalizeModelName<T extends ModelName>(model: T): ModelName {
  return model.toLowerCase() as ModelName;
}

export function beforeCreate<T extends ModelName>(
  model: T,
  callback: BeforeHookCallback<T>
): void {
  hookRegistry.addHook(normalizeModelName(model), 'create', 'before', callback);
}

export function beforeDelete<T extends ModelName>(
  model: T,
  callback: BeforeHookCallback<T>
): void {
  hookRegistry.addHook(normalizeModelName(model), 'delete', 'before', callback);
}

export function afterCreate<T extends ModelName>(
  model: T,
  callback: AfterHookCallback<T>
): void {
  hookRegistry.addHook(normalizeModelName(model), 'create', 'after', callback);
}

export function afterDelete<T extends ModelName>(
  model: T,
  callback: AfterHookCallback<T>
): void {
  hookRegistry.addHook(normalizeModelName(model), 'delete', 'after', callback);
}

export function beforeUpdate<T extends ModelName>(
  model: T,
  callback: BeforeHookCallback<T>
): void {
  hookRegistry.addHook(normalizeModelName(model), 'update', 'before', callback);
}

export function afterUpdate<T extends ModelName>(
  model: T,
  callback: AfterHookCallback<T>
): void {
  hookRegistry.addHook(normalizeModelName(model), 'update', 'after', callback);
}

export function afterChange<T extends ModelName>(
  model: T,
  column: string,
  callback: ColumnChangeCallback<T>
): void {
  hookRegistry.addColumnHook(normalizeModelName(model), column, callback);
}

export function afterUpsert<T extends ModelName>(
  model: T,
  callback: AfterHookCallback<T>
): void {
  hookRegistry.addHook(normalizeModelName(model), 'upsert', 'after', callback);
}
