import { FunctionMigration, ScriptMigration } from './interfaces/migration.interface.js';

export function isFunctionMigration(value: any): value is FunctionMigration {
  return value && typeof value === 'object' && value.id && typeof value.up === 'function';
}

export function isScriptMigration(value: any): value is ScriptMigration {
  return value && typeof value === 'object' && value.id && typeof value.script === 'string';
}
