import hookRegistry from './hookRegistry';
import type { 
  ModelName,
  BeforeHookCallback,
  AfterHookCallback,
  ColumnChangeCallback
} from '../types';

export function beforeCreate<T extends ModelName>(
  model: T, 
  callback: BeforeHookCallback<T>
): void {
  hookRegistry.addHook(model, 'create', 'before', callback);
}

export function beforeDelete<T extends ModelName>(
  model: T, 
  callback: BeforeHookCallback<T>
): void {
  hookRegistry.addHook(model, 'delete', 'before', callback);
}

export function afterCreate<T extends ModelName>(
  model: T, 
  callback: AfterHookCallback<T>
): void {
  hookRegistry.addHook(model, 'create', 'after', callback);
}

export function afterDelete<T extends ModelName>(
  model: T, 
  callback: AfterHookCallback<T>
): void {
  hookRegistry.addHook(model, 'delete', 'after', callback);
}

export function beforeUpdate<T extends ModelName>(
  model: T, 
  callback: BeforeHookCallback<T>
): void {
  hookRegistry.addHook(model, 'update', 'before', callback);
}

export function afterUpdate<T extends ModelName>(
  model: T, 
  callback: AfterHookCallback<T>
): void {
  hookRegistry.addHook(model, 'update', 'after', callback);
}

export function afterChange<T extends ModelName>(
  model: T, 
  column: string, 
  callback: ColumnChangeCallback<T>
): void {
  hookRegistry.addColumnHook(model, column, callback);
}

export function afterUpsert<T extends ModelName>(
  model: T, 
  callback: AfterHookCallback<T>
): void {
  hookRegistry.addHook(model, 'upsert', 'after', callback);
}
