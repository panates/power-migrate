import { AsyncEventEmitter } from 'node-events-async';
import { isNotEmpty, isUndefined } from 'valgen';
import { isFunctionMigration, isScriptMigration } from './guards.js';
import type {
  Migration,
  MigrationBase,
  MigrationDirection,
  MigrationLoadFunction,
} from './interfaces/migration.interface.js';
import type { MigrationRecord } from './interfaces/migration-record.interface.js';

export namespace Migrator {
  export interface Config<TContext = any> {
    context?: TContext;
    migrations?: (Migration | MigrationLoadFunction<TContext>)[];
    scriptVariables?: Record<string, string>;
  }

  export interface RunOptions {
    to?: string;
    step?: number;
  }

  export interface ListOptions {
    filter?: {
      ids?: string[];
    };
    limit?: number;
    skip?: number;
  }
}

const noOp = () => undefined;
const VARIABLE_PATTERN = /({{(\w+)}})/g;

export abstract class Migrator<TContext = never> extends AsyncEventEmitter {
  context: TContext;
  readonly migrations: Migration[] = [];
  scriptVariables: Record<string, string>;

  protected constructor(config: Migrator.Config) {
    super();
    this.context = config.context;
    this.scriptVariables = config.scriptVariables || {};
  }

  async up(options?: Migrator.RunOptions): Promise<Migration[]> {
    await this._init();
    const ids = this.migrations.map(x => x.id);
    const recs = await this.list({ filter: { ids } });
    const out: Migration[] = [];
    await this.emitAsync('start', {
      direction: 'up',
      context: this.context,
    }).catch(noOp);
    let step = 0;
    for (const migration of this.migrations) {
      const r = recs.find(x => x.id === migration.id);
      if (r?.status === 'done') continue;
      if (options?.step != null && step++ >= options.step) break;
      if (options?.to && migration.id > options.to) break;
      const eventArgs: any = { direction: 'up' as MigrationDirection, migration };
      try {
        if (isFunctionMigration(migration)) {
          await this._beforeMigrate(eventArgs).catch(noOp);
          await migration.up(this.context);
          await this._afterMigrate(eventArgs).catch(noOp);
        } else if (isScriptMigration(migration)) {
          const script = migration.script.replace(
            VARIABLE_PATTERN,
            (s, ...args: string[]) => this.scriptVariables[args[1]] || s,
          );
          eventArgs.script = script;
          await this._beforeMigrate(eventArgs).catch(noOp);
          await this._runScript(script, 'up', migration);
          await this._afterMigrate(eventArgs).catch(noOp);
        } else {
          // noinspection ExceptionCaughtLocallyJS
          throw new Error(`Invalid Migration (${(migration as MigrationBase).id})`);
        }

        out.push(migration);
      } catch (error: any) {
        await this._migrateError(error, eventArgs).catch(noOp);
        break;
      }
    }
    await this.emitAsync('finish', {
      direction: 'up',
      context: this.context,
      migrations: out,
    }).catch(noOp);
    return out;
  }

  abstract list(options?: Migrator.ListOptions): Promise<MigrationRecord[]>;

  protected async _init() {
    await this.emitAsync('init', {
      context: this.context,
    }).catch(noOp);
  }

  protected abstract _runScript(script: string, direction: MigrationDirection, migration: Migration);

  protected async _beforeMigrate(args: {
    direction: MigrationDirection;
    migration: Migration;
    script?: string;
  }): Promise<void> {
    await this.emitAsync('migrating', {
      ...args,
      context: this.context,
    }).catch(noOp);
  }

  protected async _afterMigrate(args: { direction: MigrationDirection; migration: Migration; script?: string }) {
    await this.emitAsync('migrated', {
      ...args,
      context: this.context,
    }).catch(noOp);
  }

  protected async _migrateError(
    error: any,
    args: {
      direction: MigrationDirection;
      migration: Migration;
      script?: string;
    },
  ) {
    await this.emitAsync('error', error, {
      ...args,
      context: this.context,
    }).catch(noOp);
  }

  protected async _loadMigrations(migrations: Required<Migrator.Config>['migrations']) {
    migrations = Array.isArray(migrations) ? migrations : [migrations];
    const ids: any = {};
    let migration: Migration;
    let i = 0;
    for (const mgr of migrations) {
      migration = typeof mgr === 'function' ? await mgr(this.context) : mgr;
      /** Validate */
      isNotEmpty(migration.id, {
        onFail: () => `"id" property of migration at (${i}) should be defined`,
      });
      isUndefined(ids[migration.id], {
        onFail: () => `Duplicate migration id (${migration.id})`,
      });
      this.migrations.push(migration);
      ids[migration.id] = 1;
      i++;
    }
    this.migrations.sort((a, b) => {
      if (a.id > b.id) return 1;
      if (a.id < b.id) return -1;
      return 0;
    });
  }
}
