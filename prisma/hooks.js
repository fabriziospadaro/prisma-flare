import hookRegistry from "./hookRegistry.js";

function beforeCreate(model, callback) {
  hookRegistry.addHook(model, 'create', 'before', callback);
}

function beforeDelete(model, callback) {
  hookRegistry.addHook(model, 'delete', 'before', callback);
}

function afterCreate(model, callback) {
  hookRegistry.addHook(model, 'create', 'after', callback);
}
function afterDelete(model, callback) {
  hookRegistry.addHook(model, 'delete', 'after', callback);
}

function beforeUpdate(model, callback) {
  hookRegistry.addHook(model, 'update', 'before', callback);
}

function afterUpdate(model, callback) {
  hookRegistry.addHook(model, 'update', 'after', callback);
}

function afterChange(model, column, callback) {
  hookRegistry.addColumnHook(model, column, callback);
}

function afterUpsert(model, callback) {
  hookRegistry.addHook(model, 'upsert', 'after', callback);
}

export { beforeCreate, afterCreate, beforeDelete, beforeUpdate, afterUpdate, afterChange, afterDelete, afterUpsert };
