export interface MigrationBase {
  id: string;
  title?: string;
}

export interface FunctionMigration<TContext = any> extends MigrationBase {
  up: MigrationTask<TContext>;
  down?: MigrationTask<TContext>;
}

export interface ScriptMigration extends MigrationBase {
  script: string;
}

export type Migration<TContext = any> = FunctionMigration<TContext> | ScriptMigration;

export interface MigrationTask<TContext> {
  (context: TContext): Promise<void>;
}

export type MigrationLoadFunction<TContext> = (context: TContext) => Migration | Promise<Migration>;

export type MigrationStatus = 'done' | 'error';
export type MigrationDirection = 'up' | 'down';
