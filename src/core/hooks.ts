import hookRegistry from './hookRegistry';
import type {
  ModelName,
  BeforeHookCallback,
  AfterHookCallback,
  ColumnChangeCallback,
  ColumnChangeOptions,
  HookOptions,
  FieldName
} from '../types';

function normalizeModelName<T extends ModelName>(model: T): ModelName {
  return model.toLowerCase() as ModelName;
}

export function beforeCreate<T extends ModelName>(
  model: T,
  callback: BeforeHookCallback<T>,
  options?: HookOptions
): void {
  hookRegistry.addHook(normalizeModelName(model), 'create', 'before', callback, options?.tag);
}

export function beforeDelete<T extends ModelName>(
  model: T,
  callback: BeforeHookCallback<T>,
  options?: HookOptions
): void {
  hookRegistry.addHook(normalizeModelName(model), 'delete', 'before', callback, options?.tag);
}

export function afterCreate<T extends ModelName>(
  model: T,
  callback: AfterHookCallback<T>,
  options?: HookOptions
): void {
  hookRegistry.addHook(normalizeModelName(model), 'create', 'after', callback, options?.tag);
}

export function afterDelete<T extends ModelName>(
  model: T,
  callback: AfterHookCallback<T>,
  options?: HookOptions
): void {
  hookRegistry.addHook(normalizeModelName(model), 'delete', 'after', callback, options?.tag);
}

export function beforeUpdate<T extends ModelName>(
  model: T,
  callback: BeforeHookCallback<T>,
  options?: HookOptions
): void {
  hookRegistry.addHook(normalizeModelName(model), 'update', 'before', callback, options?.tag);
}

export function afterUpdate<T extends ModelName>(
  model: T,
  callback: AfterHookCallback<T>,
  options?: HookOptions
): void {
  hookRegistry.addHook(normalizeModelName(model), 'update', 'after', callback, options?.tag);
}

export function afterChange<T extends ModelName>(
  model: T,
  column: FieldName<T>,
  callback: ColumnChangeCallback<T>,
  options?: ColumnChangeOptions<T>
): void {
  hookRegistry.addColumnHook(normalizeModelName(model), column, callback, options);
}

export function afterUpsert<T extends ModelName>(
  model: T,
  callback: AfterHookCallback<T>,
  options?: HookOptions
): void {
  hookRegistry.addHook(normalizeModelName(model), 'upsert', 'after', callback, options?.tag);
}
